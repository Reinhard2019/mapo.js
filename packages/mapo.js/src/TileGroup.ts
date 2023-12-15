import * as THREE from 'three'
import { LngLat, Terrain, TileBoxWithZ, XYZ } from './types'
import TileCache from './utils/TileCache'
import _Map from './Map'
import MercatorTile from './utils/MercatorTile'
import { isNumber, uniq } from 'lodash-es'
import TileMesh from './TileMesh'
import {
  getNextZoomXYZList,
  getOverlapTileBox,
  getPrevZoomXYZ,
  tileBox2xyzList,
  tileBoxContain,
  tileBoxOverlap,
  updateTileBoxZ,
  xyzToTileBox,
} from './utils/tile'

class TileLoader {
  private readonly tileGroup: TileGroup
  tileBox: TileBoxWithZ
  prevTileLoader?: TileLoader | undefined
  children: TileMesh[] = []
  private promise: Promise<unknown>
  private destroyed = false

  constructor(
    tileGroup: TileGroup,
    tileBox: TileBoxWithZ,
    prevTileLoader?: TileLoader | undefined,
  ) {
    this.tileGroup = tileGroup
    this.tileBox = tileBox
    this.prevTileLoader = prevTileLoader

    // 裁剪时可能会调用 tileGroup.resetChildren，在初始化完成前不能 resetChildren，因此使用 promise
    Promise.resolve().finally(() => {
      prevTileLoader?.clipTileBox(this)
    })

    const promises: Array<Promise<unknown>> = []
    if (this.prevTileLoader) {
      promises.push(
        this.prevTileLoader.promise.then(async () => {
          // 合并两个 TileLoader 前先 replaceChildren
          return await this.prevTileLoader?.replaceChildren()
        }),
      )
    }
    const previewZ = this.getPreviewZ()
    tileBox2xyzList(updateTileBoxZ(tileBox, previewZ))
      .filter(xyz => !this.prevTileLoaderContain(xyz))
      .forEach(xyz => {
        const tileMesh = this.getTileMesh(xyz)
        this.addChild(tileMesh)
        promises.push(tileMesh.load().then(async () => await this.splitTileMesh(tileMesh)))
      })
    this.promise = Promise.allSettled(promises)

    if (this.prevTileLoader) {
      // 合并两个 TileLoader
      this.promise.finally(() => {
        if (!this.prevTileLoader || this.destroyed) return

        this.children = uniq(this.children.concat(this.prevTileLoader.children))
        this.prevTileLoader.dispose()
        this.prevTileLoader = undefined
        this.tileGroup.resetChildren()
      })
    }
  }

  /**
   * 获取初始化时的预览 z
   * @returns
   */
  private getPreviewZ() {
    const { tileBox } = this
    const maxGap = Math.max(tileBox.endX - tileBox.startX, tileBox.endY - tileBox.startY)
    const previewZ = tileBox.z - Math.ceil(Math.log2(maxGap))
    return Math.max(previewZ, 0)
  }

  private getTileZoom([x, y, z]: XYZ) {
    const { earthOrbitControls } = this.tileGroup.map
    const lngLat: LngLat = [MercatorTile.xToLng(x + 0.5, z), MercatorTile.yToLat(y + 0.5, z)]
    return earthOrbitControls.lngLatToZoom(lngLat)
  }

  private getTileMesh(xyz: XYZ) {
    const { tileMeshCache } = this.tileGroup
    let tileMesh = tileMeshCache.get(xyz)
    if (!tileMesh) {
      tileMesh = new TileMesh(xyz, this.tileGroup)
      tileMeshCache.set(xyz, tileMesh)
    }
    return tileMesh
  }

  private addChild(tileMesh: TileMesh) {
    if (this.destroyed) return

    this.children.push(tileMesh)

    this.tileGroup.children.push(tileMesh)

    tileMesh.show()
  }

  private removeChild(tileMesh: TileMesh) {
    if (this.destroyed) return

    const index = this.children.findIndex(c => c === tileMesh)
    if (index === -1) return
    this.children.splice(index, 1)

    this.tileGroup.resetChildren()
  }

  /**
   * tile 是否完全包含于上一个 TileLoader
   * @param xyz
   * @returns
   */
  private prevTileLoaderContain(xyz: XYZ) {
    if (!this.prevTileLoader?.tileBox) return false

    const prevOverlapTileBox = getOverlapTileBox(this.prevTileLoader?.tileBox, xyzToTileBox(xyz))
    if (!prevOverlapTileBox) return false

    const overlapTileBox = getOverlapTileBox(this.tileBox, xyzToTileBox(xyz))
    return !!overlapTileBox && tileBoxContain(prevOverlapTileBox, overlapTileBox)
  }

  /**
   * 是否与当前瓦片范围重叠
   * @param xyz
   * @returns
   */
  private tileBoxOverlap(xyz: XYZ) {
    return !this.prevTileLoaderContain(xyz) && tileBoxOverlap(this.tileBox, xyzToTileBox(xyz))
  }

  /**
   * 重新设置 tileBox
   * @param tileBox
   */
  resetTileBox(tileBox: TileBoxWithZ) {
    this.tileBox = tileBox
    this.clipTileBox()
    this.promise = this.promise.then(async () => await this.replaceChildren())
  }

  /**
   * 裁剪 tileBox
   * @param nextTileLoader
   * @returns
   */
  private clipTileBox(nextTileLoader?: TileLoader) {
    if (nextTileLoader) {
      const newTileBox = getOverlapTileBox(this.tileBox, nextTileLoader.tileBox)
      if (!newTileBox) {
        this.dispose()
        nextTileLoader.prevTileLoader = undefined
        this.tileGroup.resetChildren()
        return
      }
      this.tileBox = newTileBox
    }

    const copyChildren = [...this.children]
    copyChildren.forEach(child => {
      if (!tileBoxOverlap(this.tileBox, xyzToTileBox(child.xyz))) {
        this.removeChild(child)
      }
    })

    this.prevTileLoader?.clipTileBox(this)
  }

  /**
   * 重置 children，合并 tileMesh 或者拆分 tileMesh
   */
  private async replaceChildren() {
    const previewZ = this.getPreviewZ()
    const promises = this.children.map(async child => {
      if (child.xyz[2] < this.getTileZoom(child.xyz)) {
        await this.splitTileMesh(child, previewZ)
        return
      }

      const z = this.tileGroup.tileLoader!.tileBox.z
      const tileZ = child.xyz[2]
      let prevZoomXYZ = getPrevZoomXYZ(child.xyz, z < tileZ ? tileZ - z : 1)
      if (prevZoomXYZ && prevZoomXYZ[2] >= this.getTileZoom(prevZoomXYZ)) {
        while (true) {
          const newPrevZoomXYZ = getPrevZoomXYZ(prevZoomXYZ, 1)
          if (newPrevZoomXYZ && newPrevZoomXYZ[2] >= this.getTileZoom(newPrevZoomXYZ)) {
            prevZoomXYZ = newPrevZoomXYZ
          } else {
            break
          }
        }
        await this.mergeTileMesh(child, prevZoomXYZ)
      }
    })

    await Promise.allSettled(promises)
  }

  private async mergeTileMesh(tileMesh: TileMesh, mergeXYZ: XYZ) {
    const { taskQueue } = this.tileGroup.map
    const mergeTileMesh = await taskQueue.addWithPromise(() => this.getTileMesh(mergeXYZ))
    await mergeTileMesh.load()
    if (this.tileBoxOverlap(mergeTileMesh.xyz)) this.addChild(mergeTileMesh)
    this.removeChild(tileMesh)
  }

  /**
   * 拆分 tileMesh
   * @param tileMesh
   * @param previewZ 存在时，将直接拆分至 previewZ 级别
   * @returns
   */
  private async splitTileMesh(tileMesh: TileMesh, previewZ?: number) {
    if (tileMesh.xyz[2] >= this.getTileZoom(tileMesh.xyz)) return

    let splitXYZList: XYZ[] = []
    if (isNumber(previewZ) && previewZ > tileMesh.xyz[2]) {
      const overlapTileBox = getOverlapTileBox(this.tileBox, xyzToTileBox(tileMesh.xyz))
      if (overlapTileBox) {
        splitXYZList = tileBox2xyzList(updateTileBoxZ(overlapTileBox, previewZ))
      }
    } else {
      splitXYZList = getNextZoomXYZList(tileMesh.xyz)
    }
    splitXYZList = splitXYZList.filter(xyz => this.tileBoxOverlap(xyz))

    const { taskQueue } = this.tileGroup.map

    const promiseSettledResultList = await Promise.allSettled(
      splitXYZList.map(async xyz => {
        const splitTileMesh = await taskQueue.addWithPromise(() => this.getTileMesh(xyz))
        await splitTileMesh.load()
        if (this.tileBoxOverlap(splitTileMesh.xyz)) this.addChild(splitTileMesh)
        return splitTileMesh
      }),
    )

    this.removeChild(tileMesh)

    await Promise.allSettled(
      promiseSettledResultList.flatMap(v =>
        v.status === 'fulfilled' ? [this.splitTileMesh(v.value)] : [],
      ),
    )
  }

  dispose() {
    this.destroyed = true
    this.prevTileLoader?.dispose()
  }
}

class TileGroup extends THREE.Group {
  declare children: TileMesh[]

  readonly map: _Map
  readonly tileMeshCache = new TileCache<TileMesh>()
  readonly terrainTileCache = new TileCache<Promise<ImageData>>()
  terrain: Terrain | undefined
  tileLoader?: TileLoader

  constructor(options: { map: _Map; terrain: Terrain | undefined }) {
    super()

    this.map = options.map
    this.terrain = options.terrain
  }

  setTerrain(terrain: Terrain | undefined) {
    this.terrain = terrain

    this.children.forEach(child => {
      child.geometry.resetTerrain()
    })
  }

  resetMaterial() {
    this.children.forEach(child => {
      child.resetMaterial()
    })
  }

  /**
   * 重置 TileGroup 的 children
   */
  resetChildren() {
    const children: TileMesh[] = []
    let tileLoader = this.tileLoader
    while (tileLoader) {
      children.push(...tileLoader.children)
      tileLoader = tileLoader.prevTileLoader
    }
    this.children = children
  }

  update() {
    const { displayTileBoxChange, displayTileBox: tileBox } = this.map
    if (!displayTileBoxChange) return

    if (this.tileLoader?.tileBox && tileBoxContain(this.tileLoader?.tileBox, tileBox)) {
      this.tileLoader.resetTileBox(tileBox)
    } else {
      this.tileLoader = new TileLoader(this, tileBox, this.tileLoader)
    }

    this.resetMaterial()
  }

  dispose() {
    this.tileMeshCache.toArray().forEach(mesh => {
      mesh.dispose()
    })

    this.tileLoader?.dispose()
  }
}

export default TileGroup
