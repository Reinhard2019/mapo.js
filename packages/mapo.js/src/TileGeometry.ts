import * as THREE from 'three'
import { XYZ } from './types'
import { lngLatToVector3 } from './utils/map'
import EquirectangularTile from './utils/EquirectangularTile'

class TileGeometry extends THREE.BufferGeometry {
  earthRadius: number
  tileSize: number
  xyz: XYZ

  constructor(options: { xyz: XYZ; earthRadius: number; tileSize: number }) {
    super()

    Object.assign(this, options)

    this.update()
  }

  update() {
    const { earthRadius, xyz } = this
    const [, , z] = xyz
    const [w, s, e, n] = EquirectangularTile.tileToBBox(xyz)
    const startWest = w
    const startNorth = n

    const totalHeightSegments = 128
    const heightSegments = totalHeightSegments / Math.min(Math.pow(2, z), totalHeightSegments)
    const widthSegments = heightSegments * 2
    const widthPositionCount = widthSegments + 1
    const heightPositionCount = heightSegments + 1
    const lngGap = (e - w) / widthSegments
    const latGap = (n - s) / heightSegments

    // const scaledTileSize = tileSize / Math.pow(2, 3)
    // const widthSegments = scaledTileSize
    // const heightSegments = scaledTileSize / 2
    // const widthPositionCount = widthSegments + 1
    // const heightPositionCount = heightSegments + 1
    // const lngGap = 360 / Math.pow(2, z) / scaledTileSize
    // const latGap = lngGap

    const positions: number[] = []
    const lngLats: number[][] = []
    for (let y = 0; y < heightPositionCount; y++) {
      const lat = startNorth - y * latGap
      for (let x = 0; x < widthPositionCount; x++) {
        const lng = startWest + x * lngGap
        const position = lngLatToVector3([lng, lat], earthRadius)
        positions.push(...position.toArray())
        lngLats.push([lng, lat])
      }
    }
    this.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3))

    const indexArr: number[] = []
    for (let y = 0; y < heightSegments; y++) {
      for (let x = 0; x < widthSegments; x++) {
        const positionIndex1 = x + y * widthPositionCount
        const positionIndex2 = positionIndex1 + 1
        const positionIndex3 = positionIndex1 + widthPositionCount
        const positionIndex4 = positionIndex2 + widthPositionCount
        const face1 = [positionIndex1, positionIndex3, positionIndex2]
        const face2 = [positionIndex2, positionIndex3, positionIndex4]
        indexArr.push(...face1, ...face2)
      }
    }
    this.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(indexArr), 1))
  }
}

export default TileGeometry
