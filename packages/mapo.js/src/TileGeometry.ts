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

  private widthPositionCount = 0

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
    const [x, y, z] = xyz

    const totalHeightSegments = 128
    const heightSegments = totalHeightSegments / Math.min(Math.pow(2, z), totalHeightSegments)
    const widthSegments = heightSegments * 2
    const widthPositionCount = widthSegments + 1
    const heightPositionCount = heightSegments + 1

    const positions: number[] = []
    const uvs: number[] = []
    const addLine = (lat: number) => {
      for (let xi = 0; xi < widthPositionCount; xi++) {
        const lng = MercatorTile.xToLng(x + xi / widthSegments, z)
        const position = lngLatToVector3([lng, lat], earthRadius)
        positions.push(...position.toArray())
        uvs.push(lng, lat)
      }
    }

    let extraHeightSegments = 0
    if (y === 0) {
      addLine(90)
      extraHeightSegments++
    }
    for (let yi = 0; yi < heightPositionCount; yi++) {
      const lat = MercatorTile.yToLat(y + yi / heightSegments, z)
      addLine(lat)
    }
    if (y === Math.pow(2, z) - 1) {
      addLine(-90)
      extraHeightSegments++
    }
    this.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3))
    this.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(uvs), 2))

    const indexes: number[] = []
    for (let yi = 0; yi < heightSegments + extraHeightSegments; yi++) {
      for (let xi = 0; xi < widthSegments; xi++) {
        const positionIndex1 = xi + yi * widthPositionCount
        const positionIndex2 = positionIndex1 + 1
        const positionIndex3 = positionIndex1 + widthPositionCount
        const positionIndex4 = positionIndex2 + widthPositionCount
        const face1 = [positionIndex1, positionIndex3, positionIndex2]
        const face2 = [positionIndex2, positionIndex3, positionIndex4]
        indexes.push(...face1, ...face2)
      }
    }
    this.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(indexes), 1))

    this.widthPositionCount = widthPositionCount
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
        this.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(e.data.uvs), 2))
        this.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(e.data.indexes), 1))
        this.widthPositionCount = e.data.widthPositionCount

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
    // 更新底边时，如果 y 是最后一个，则无需更新
    if (side === 'bottom' || side === 'rightBottom') {
      const [, y, z] = this.xyz
      const z2 = Math.pow(2, z)
      if (y === z2 - 1) return
    }

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

      if (side === 'bottom') {
        const startXI = positions.count - this.widthPositionCount
        for (let i = 0; i < this.widthPositionCount - 1; i++) {
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
        for (let i = 0; i < heightPositionCount - 1; i++) {
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

  dispose() {
    super.dispose()
    this.disposeFuncList.forEach(func => func())
  }
}

export default TileGeometry
