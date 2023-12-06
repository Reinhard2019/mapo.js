import * as THREE from 'three'
import { XYZ } from './types'
import {
  getBottomNearXYZ,
  getLeftNearXYZ,
  getRightNearXYZ,
  getTerrainUrl,
  getTopNearXYZ,
} from './utils/map'
import TileGeometryWorker, { OnMessageEventData, getGeometryAttribute } from './TileGeometryWorker'
import { isNil } from './utils'
import TileGroup from './TileGroup'
import TileMesh from './TileMesh'

class TileGeometry extends THREE.BufferGeometry {
  private readonly tileMesh: TileMesh
  private readonly tileGroup: TileGroup
  private updateTerrainPromise: Promise<THREE.Float32BufferAttribute> | undefined

  // 0 代表关闭 Terrain
  private terrainExaggeration = 0

  private widthPositionCount = 0

  constructor(options: { tileGroup: TileGroup; tileMesh: TileMesh }) {
    super()

    Object.assign(this, options)

    this.update()
  }

  resetTerrain() {
    const { terrain, terrainTileCache } = this.tileGroup
    const { tileSize } = this.tileGroup.map
    let exaggeration = 0
    if (typeof terrain === 'object') {
      exaggeration = terrain.exaggeration ?? 0
    } else {
      exaggeration = terrain ? 1 : 0
    }

    if (exaggeration === this.terrainExaggeration) return
    this.terrainExaggeration = exaggeration

    if (!exaggeration) {
      this.update()
    }

    const terrainXYZ = this.getTerrainXYZ()
    let promise = terrainTileCache.get(terrainXYZ)
    if (!promise) {
      const url = getTerrainUrl(this.getTerrainXYZ())
      promise = new THREE.ImageBitmapLoader().loadAsync(url).then(imageBitmap => {
        const canvas = new OffscreenCanvas(tileSize, tileSize)
        const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
        // 部份瓦片存在一些多余的裙边
        const sx = (imageBitmap.width - tileSize) / 2
        const sy = (imageBitmap.height - tileSize) / 2
        ctx.drawImage(imageBitmap, sx, sy, tileSize, tileSize, 0, 0, tileSize, tileSize)
        return ctx.getImageData(0, 0, tileSize, tileSize)
      })
      terrainTileCache.set(terrainXYZ, promise)
      promise.catch(() => {
        terrainTileCache.delete(terrainXYZ)
      })
    }
    void promise.then(imageData => {
      this.updateTerrain(imageData, exaggeration)
    })
  }

  private getTerrainXYZ(): XYZ {
    const [x, y, z] = this.tileMesh.xyz
    //  高程的 z 比正常的 z 缩小 3 倍
    const scaleZ = 3
    const terrainZ = Math.max(0, z - scaleZ)
    const scaleZ2 = Math.pow(2, z - terrainZ)
    const getTerrainTileIndex = (tileIndex: number) => Math.floor(tileIndex / scaleZ2)
    return [getTerrainTileIndex(x), getTerrainTileIndex(y), terrainZ]
  }

  private update() {
    const { xyz } = this.tileMesh
    const { earthRadius } = this.tileGroup.map
    const [, , z] = xyz

    const totalHeightSegments = 128
    const heightSegments = totalHeightSegments / Math.min(Math.pow(2, z), totalHeightSegments)
    const widthSegments = heightSegments * 2

    const { positions, uvs, lngLats, indexes, widthPositionCount } = getGeometryAttribute(
      widthSegments,
      heightSegments,
      xyz,
      earthRadius,
    )

    this.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3))
    this.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(uvs), 2))
    this.setAttribute('lngLat', new THREE.Float32BufferAttribute(new Float32Array(lngLats), 2))
    this.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(indexes), 1))

    this.widthPositionCount = widthPositionCount
    this.terrainExaggeration = 0
  }

  private updateTerrain(terrainImageData: ImageData, terrainExaggeration: number) {
    if (!isNil(this.updateTerrainPromise)) return

    const tileGeometryWorker = new TileGeometryWorker()
    const { xyz } = this.tileMesh
    const { earthRadius, tileSize } = this.tileGroup.map
    const terrainXYZ = this.getTerrainXYZ()
    const [, , terrainZ] = terrainXYZ
    const [x, y, z] = xyz

    this.updateTerrainPromise = new Promise(resolve => {
      tileGeometryWorker.onmessage = (e: MessageEvent<OnMessageEventData>) => {
        const positions = new THREE.Float32BufferAttribute(new Float32Array(e.data.positions), 3)
        this.setAttribute('position', positions)
        this.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(e.data.uvs), 2))
        this.setAttribute(
          'lngLat',
          new THREE.Float32BufferAttribute(new Float32Array(e.data.lngLats), 2),
        )
        this.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(e.data.indexes), 1))
        this.widthPositionCount = e.data.widthPositionCount

        tileGeometryWorker.terminate()

        const scaleZ2 = Math.pow(2, z - terrainZ)
        const isFirstX = x % scaleZ2 === 0
        const isFirstY = y % scaleZ2 === 0
        const isLastX = x % scaleZ2 === scaleZ2 - 1
        const isLastY = y % scaleZ2 === scaleZ2 - 1
        if (isFirstY) {
          const geometry = this.getTileGeometry(getTopNearXYZ(xyz))
          void geometry?.updateSideTerrain('bottom')
        }
        if (isFirstX) {
          const geometry = this.getTileGeometry(getLeftNearXYZ(xyz))
          void geometry?.updateSideTerrain('right')
        }
        if (isFirstX && isFirstY) {
          const geometry = this.getTileGeometry(getLeftNearXYZ(getTopNearXYZ(xyz)))
          void geometry?.updateSideTerrain('rightBottom')
        }
        if (isLastY) void this.updateSideTerrain('bottom')
        if (isLastX) void this.updateSideTerrain('right')
        if (isLastX && isLastY) void this.updateSideTerrain('rightBottom')

        resolve(positions)
      }
    })

    tileGeometryWorker.postMessage({
      earthRadius,
      tileSize,
      xyz,
      terrainXYZ,
      terrainImageData,
      exaggeration: terrainExaggeration,
    })
  }

  /**
   * terrain tile 的交界处，瓦片的右下角最外面一圈依赖相邻的瓦片来补充
   * @param side
   * @returns
   */
  private async updateSideTerrain(side: 'right' | 'bottom' | 'rightBottom') {
    const { xyz } = this.tileMesh
    // 更新底边时，如果 y 是最后一个，则无需更新
    if (side === 'bottom' || side === 'rightBottom') {
      const [, y, z] = xyz
      const z2 = Math.pow(2, z)
      if (y === z2 - 1) return
    }

    let nearXYZ: XYZ
    if (side === 'bottom') {
      nearXYZ = getBottomNearXYZ(xyz)
    } else if (side === 'right') {
      nearXYZ = getRightNearXYZ(xyz)
    } else {
      nearXYZ = getRightNearXYZ(getBottomNearXYZ(xyz))
    }
    const nearGeometry = this.getTileGeometry(nearXYZ)
    const promises = [this.updateTerrainPromise, nearGeometry?.updateTerrainPromise]
    if (promises.some(isNil)) return

    void Promise.all(promises).then(() => {
      const positions = this.getAttribute('position') as THREE.Float32BufferAttribute
      const nearPositions = nearGeometry?.getAttribute('position') as THREE.Float32BufferAttribute

      if (side === 'bottom') {
        const startXI = positions.count - this.widthPositionCount
        for (let i = 0; i < this.widthPositionCount; i++) {
          const xi = startXI + i
          const nearXI = i
          positions.setXYZ(
            xi,
            nearPositions.getX(nearXI),
            nearPositions.getY(nearXI),
            nearPositions.getZ(nearXI),
          )
        }
      } else if (side === 'right') {
        const heightPositionCount = positions.count / this.widthPositionCount
        for (let i = 0; i < heightPositionCount; i++) {
          const yi = (i + 1) * this.widthPositionCount - 1
          const nearYI = i * this.widthPositionCount
          positions.setXYZ(
            yi,
            nearPositions.getX(nearYI),
            nearPositions.getY(nearYI),
            nearPositions.getZ(nearYI),
          )
        }
      } else if (side === 'rightBottom') {
        const i = positions.count - 1
        const nearI = 0
        positions.setXYZ(
          i,
          nearPositions.getX(nearI),
          nearPositions.getY(nearI),
          nearPositions.getZ(nearI),
        )
      }

      positions.needsUpdate = true
    })
  }

  private getTileGeometry(xyz: XYZ | undefined) {
    if (!xyz) return
    return this.tileGroup.tileMeshCache.get(xyz)?.geometry
  }
}

export default TileGeometry
