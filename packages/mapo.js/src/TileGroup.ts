import * as THREE from 'three'
import { LngLat, Terrain, TileBoxWithZ, XYZ } from './types'
import TileCache from './utils/TileCache'
import _Map from './Map'
import { getSatelliteUrl, lngLatToVector3 } from './utils/map'
import MercatorTile from './utils/MercatorTile'
import { isEqual, isNumber, uniq, uniqBy } from 'lodash-es'
import TileMesh from './TileMesh'
import CanvasLayerManager from './layers/CanvasLayerManager'
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
    uniqBy(
      tileBox2xyzList(updateTileBoxZ(tileBox, previewZ))
        .filter(xyz => !this.prevTileLoaderContain(xyz))
        .map(xyz => this.getPlaceholderXYZ(xyz)),
      isEqual,
    ).forEach(xyz => {
      const promise = (async () => {
        const imageBitmap = await this.getTilePromise(xyz)
        const tileMesh = await this.addChild(xyz, imageBitmap)
        if (tileMesh) {
          await this.splitTileMesh(tileMesh, previewZ)
        }
      })()
      promises.push(promise)
    })
    this.promise = Promise.allSettled(promises)

    this.prevTileLoader?.clipTileBox(this)
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
   * TileMesh 是否加载完毕
   * @param _xyz
   * @returns
   */
  isLoadedXYZ(xyz: XYZ) {
    const { tileMeshCache } = this.tileGroup
    const tileMesh = tileMeshCache.get(xyz)
    return !!tileMesh?.tileMaterialLoaded
  }

  getPlaceholderXYZ(xyz: XYZ) {
    while (!this.isLoadedXYZ(xyz)) {
      const newXYZ = getPrevZoomXYZ(xyz)
      if (!newXYZ) break
      xyz = newXYZ
    }
    return xyz
  }

  /**
   * 获取初始化时的预览 z
   * @returns
   */
  getPreviewZ() {
    const { tileBox } = this
    const maxGap = Math.max(tileBox.endX - tileBox.startX, tileBox.endY - tileBox.startY)
    return tileBox.z - Math.ceil(Math.log2(maxGap))
  }

  getTileZoom([x, y, z]: XYZ) {
    const { map } = this.tileGroup
    const { earthRadius } = map
    const lngLat: LngLat = [MercatorTile.xToLng(x + 0.5, z), MercatorTile.yToLat(y + 0.5, z)]
    const distance = map.earthOrbitControls.camera.position.distanceTo(
      lngLatToVector3(lngLat, earthRadius),
    )
    return map.earthOrbitControls.distanceToZoom(distance + earthRadius)
  }

  async getTilePromise(xyz: XYZ) {
    const { tileCache } = this.tileGroup
    const url = getSatelliteUrl(xyz)
    let promise = tileCache.get(xyz)
    if (!promise) {
      promise = new THREE.ImageBitmapLoader().loadAsync(url)
      tileCache.set(xyz, promise)
      promise.catch(() => {
        tileCache.delete(xyz)
      })
    }
    return await promise
  }

  async addChild(xyz: XYZ, imageBitmap: ImageBitmap): Promise<TileMesh> {
    return await new Promise((resolve, reject) => {
      this.tileGroup.map.taskQueue.add(() => {
        if (this.destroyed || !this.isBelongTileBox(xyz)) {
          reject(new Error(''))
          return
        }

        const { tileMeshCache } = this.tileGroup
        let tileMesh = tileMeshCache.get(xyz)
        if (!tileMesh) {
          tileMesh = new TileMesh(xyz, this.tileGroup, imageBitmap)
          tileMeshCache.set(xyz, tileMesh)
        }

        this.children.push(tileMesh)

        this.tileGroup.children.push(tileMesh)

        tileMesh.show()

        resolve(tileMesh)
      })
    })
  }

  removeChild(tileMesh: TileMesh) {
    if (this.destroyed) return

    const index = this.children.findIndex(c => c === tileMesh)
    if (index === -1) return
    this.children.splice(index, 1)

    this.tileGroup.resetChildren()
  }

  prevTileLoaderContain(xyz: XYZ) {
    if (!this.prevTileLoader?.tileBox) return false

    const prevOverlapTileBox = getOverlapTileBox(this.prevTileLoader?.tileBox, xyzToTileBox(xyz))
    if (!prevOverlapTileBox) return false

    const overlapTileBox = getOverlapTileBox(this.tileBox, xyzToTileBox(xyz))
    return !!overlapTileBox && tileBoxContain(prevOverlapTileBox, overlapTileBox)
  }

  isBelongTileBox(xyz: XYZ) {
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
  clipTileBox(nextTileLoader?: TileLoader) {
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
  async replaceChildren() {
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

  async mergeTileMesh(tileMesh: TileMesh, prevZoomXYZ: XYZ) {
    const imageBitmap = await this.getTilePromise(prevZoomXYZ)
    await this.addChild(prevZoomXYZ, imageBitmap).then(() => {
      this.removeChild(tileMesh)
    })
  }

  /**
   * 拆分 tileMesh
   * @param tileMesh
   * @param previewZ 存在时，将直接拆分至 previewZ 级别
   * @returns
   */
  async splitTileMesh(tileMesh: TileMesh, previewZ?: number) {
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
    splitXYZList = splitXYZList.filter(xyz => this.isBelongTileBox(xyz))

    const promiseSettledResultList = await Promise.allSettled(
      splitXYZList.map(async xyz => await this.getTilePromise(xyz)),
    )

    const addChildPromises: Array<Promise<TileMesh>> = []
    for (let i = 0; i < promiseSettledResultList.length; i++) {
      const promiseSettledResult = promiseSettledResultList[i]
      if (promiseSettledResult.status === 'fulfilled') {
        const imageBitmap = promiseSettledResult.value
        const promise = this.addChild(splitXYZList[i], imageBitmap)
        addChildPromises.push(promise)
      }
    }

    const addChildPromiseSettledResultList = await Promise.allSettled(addChildPromises)

    this.removeChild(tileMesh)

    await Promise.allSettled(
      addChildPromiseSettledResultList.flatMap(v =>
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
  readonly canvasLayerManager: CanvasLayerManager
  readonly tileMeshCache = new TileCache<TileMesh>()
  readonly tileCache = new TileCache<Promise<ImageBitmap>>()
  readonly terrainTileCache = new TileCache<Promise<ImageData>>()
  terrain: Terrain | undefined
  needsUpdate = true
  tileLoader?: TileLoader

  constructor(options: { map: _Map; terrain: Terrain | undefined }) {
    super()

    this.map = options.map
    this.canvasLayerManager = new CanvasLayerManager(options.map)
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
    if (!this.needsUpdate) return
    this.needsUpdate = false

    const { displayBBox } = this.map
    const { zoom } = this.map.earthOrbitControls
    const z = Math.ceil(zoom)

    const tileBox: TileBoxWithZ = {
      ...MercatorTile.bboxToTileBox(displayBBox, z),
      z,
    }
    if (!isEqual(this.tileLoader?.tileBox, tileBox)) {
      this.canvasLayerManager.updateTileBox(tileBox)

      if (this.tileLoader?.tileBox && tileBoxContain(this.tileLoader?.tileBox, tileBox)) {
        this.tileLoader.resetTileBox(tileBox)
      } else {
        this.tileLoader = new TileLoader(this, tileBox, this.tileLoader)
      }

      this.resetMaterial()
    }

    this.canvasLayerManager.needsUpdate = true
  }

  dispose() {
    this.tileMeshCache.toArray().forEach(mesh => {
      mesh.dispose()
    })
  }
}

export default TileGroup
