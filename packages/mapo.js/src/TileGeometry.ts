import * as THREE from 'three'
import { XYZ } from './types'
import {
  getBottomNearXYZ,
  getLeftNearXYZ,
  getRightNearXYZ,
  getTopNearXYZ,
  lngLatToVector3,
} from './utils/map'
import MercatorTile from './utils/MercatorTile'
import TileGeometryWorker, { OnMessageEventData } from './TileGeometryWorker'
import TileGroup from './TileGroup'
import { isNil } from './utils'

class TileGeometry extends THREE.BufferGeometry {
  earthRadius: number
  tileSize: number
  xyz: XYZ
  terrainXYZ: XYZ
  private readonly tileGroup: TileGroup
  private updateTerrainPromise: Promise<THREE.Float32BufferAttribute> | undefined
  private readonly disposeFuncList: Array<() => void> = []

  constructor(options: {
    tileGroup: TileGroup
    xyz: XYZ
    terrainXYZ: XYZ
    earthRadius: number
    tileSize: number
  }) {
    super()

    Object.assign(this, options)

    this.update()
  }

  update() {
    const { earthRadius, xyz } = this
    const [tileX, tileY, z] = xyz

    const totalHeightSegments = 128
    const heightSegments = totalHeightSegments / Math.min(Math.pow(2, z), totalHeightSegments)
    const widthSegments = heightSegments * 2
    const widthPositionCount = widthSegments + 1
    const heightPositionCount = heightSegments + 1

    const positions: number[] = []
    const lngLats: number[][] = []
    for (let y = 0; y < heightPositionCount; y++) {
      const lat = MercatorTile.yToLat(tileY + y / heightSegments, z)
      for (let x = 0; x < widthPositionCount; x++) {
        const lng = MercatorTile.xToLng(tileX + x / widthSegments, z)
        const position = lngLatToVector3([lng, lat], earthRadius)
        positions.push(...position.toArray())
        lngLats.push([lng, lat])
      }
    }
    this.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3))

    const indexes: number[] = []
    for (let y = 0; y < heightSegments; y++) {
      for (let x = 0; x < widthSegments; x++) {
        const positionIndex1 = x + y * widthPositionCount
        const positionIndex2 = positionIndex1 + 1
        const positionIndex3 = positionIndex1 + widthPositionCount
        const positionIndex4 = positionIndex2 + widthPositionCount
        const face1 = [positionIndex1, positionIndex3, positionIndex2]
        const face2 = [positionIndex2, positionIndex3, positionIndex4]
        indexes.push(...face1, ...face2)
      }
    }
    this.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(indexes), 1))
  }

  updateTerrain(terrainImageData: ImageData, exaggeration: number) {
    if (!isNil(this.updateTerrainPromise)) return

    const tileGeometryWorker = new TileGeometryWorker()
    const { earthRadius, tileSize, xyz, terrainXYZ } = this
    const [, , terrainZ] = terrainXYZ
    const [x, y, z] = xyz

    this.updateTerrainPromise = new Promise(resolve => {
      tileGeometryWorker.onmessage = (e: MessageEvent<OnMessageEventData>) => {
        const positions = new THREE.Float32BufferAttribute(new Float32Array(e.data.positions), 3)
        this.setAttribute('position', positions)
        this.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(e.data.indexes), 1))

        tileGeometryWorker.terminate()

        const scaleZ2 = Math.pow(2, z - terrainZ)
        const isFirstX = x % scaleZ2 === 0
        const isFirstY = y % scaleZ2 === 0
        const isLastX = x % scaleZ2 === scaleZ2 - 1
        const isLastY = y % scaleZ2 === scaleZ2 - 1
        if (isFirstY) {
          const geometry = this.tileGroup.getTileGeometry(getTopNearXYZ(xyz))
          void geometry?.updateSideTerrain('bottom')
        }
        if (isFirstX) {
          const geometry = this.tileGroup.getTileGeometry(getLeftNearXYZ(xyz))
          void geometry?.updateSideTerrain('right')
        }
        if (isFirstX && isFirstY) {
          const geometry = this.tileGroup.getTileGeometry(getLeftNearXYZ(getTopNearXYZ(xyz)))
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
      exaggeration,
    })
  }

  /**
   * terrain tile 的交界处，瓦片的右下角最外面一圈依赖相邻的瓦片来补充
   * @param side
   * @returns
   */
  async updateSideTerrain(side: 'right' | 'bottom' | 'rightBottom') {
    let nearXYZ: XYZ
    if (side === 'bottom') {
      nearXYZ = getBottomNearXYZ(this.xyz)
    } else if (side === 'right') {
      nearXYZ = getRightNearXYZ(this.xyz)
    } else {
      nearXYZ = getRightNearXYZ(getBottomNearXYZ(this.xyz))
    }
    const nearGeometry = this.tileGroup.getTileGeometry(nearXYZ)
    const promises = [this.updateTerrainPromise, nearGeometry?.updateTerrainPromise]
    if (promises.some(isNil)) return

    void Promise.all(promises).then(() => {
      const positions = this.getAttribute('position') as THREE.Float32BufferAttribute
      const nearPositions = nearGeometry?.getAttribute('position') as THREE.Float32BufferAttribute

      const positionCount = Math.sqrt(positions.count)
      if (side === 'bottom') {
        const startXI = (positionCount - 1) * positionCount
        for (let i = 0; i < positionCount; i++) {
          const xi = startXI + i
          const nearXI = i
          positions?.setXYZ(
            xi,
            nearPositions.getX(nearXI),
            nearPositions.getY(nearXI),
            nearPositions.getZ(nearXI),
          )
        }
      } else if (side === 'right') {
        console.groupCollapsed(this.xyz.toString())
        for (let i = 0; i < positionCount; i++) {
          const yi = (i + 1) * positionCount - 1
          const nearYI = i * positionCount
          console.log(yi, nearYI)
          positions?.setXYZ(
            yi,
            nearPositions.getX(nearYI),
            nearPositions.getY(nearYI),
            nearPositions.getZ(nearYI),
          )
        }
        console.groupEnd()
      } else {
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

  dispose() {
    super.dispose()
    this.disposeFuncList.forEach(func => func())
  }
}

export default TileGeometry
