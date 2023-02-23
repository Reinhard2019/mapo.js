import * as THREE from 'three'
import { BBox } from './types'
import { fullBBox } from './utils/bbox'
import { lngLatToVector3 } from './utils/map'

class EarthGeometry extends THREE.BufferGeometry {
  bbox: BBox = fullBBox
  earthRadius: number

  constructor (options: {
    bbox?: BBox
    earthRadius: number
    tileSize: number
    z: number
    /**
     * 延时更新 Geometry
     */
    delay?: boolean
  }) {
    super()

    this.earthRadius = options.earthRadius
    if (options.bbox) this.bbox = options.bbox
    if (!options.delay) this.update()
  }

  update () {
    const { bbox, earthRadius } = this
    const heightSegments = 128
    const widthSegments = heightSegments * 2
    const widthPositionCount = widthSegments + 1
    const heightPositionCount = heightSegments + 1
    const [w, s, e, n] = bbox
    const lngGap = (e - w) / widthSegments
    const latGap = (n - s) / heightSegments

    const positions: number[] = []
    const uvs: number[] = []
    for (let y = 0; y < heightPositionCount; y++) {
      const lat = s + y * latGap
      for (let x = 0; x < widthPositionCount; x++) {
        const lng = w + x * lngGap
        const position = lngLatToVector3([lng, lat], earthRadius)
        positions.push(...position.toArray())

        const uvX = x / widthSegments
        const uvY = y / heightSegments
        uvs.push(uvX, uvY)
      }
    }
    this.attributes.position = new THREE.Float32BufferAttribute(new Float32Array(positions), 3)
    this.attributes.uv = new THREE.Float32BufferAttribute(new Float32Array(uvs), 2)

    const indexArr: number[] = []
    for (let y = 0; y < heightSegments; y++) {
      for (let x = 0; x < widthSegments; x++) {
        const positionIndex1 = x + y * widthPositionCount
        const positionIndex2 = positionIndex1 + 1
        const positionIndex3 = positionIndex1 + widthPositionCount
        const positionIndex4 = positionIndex2 + widthPositionCount
        const face1 = [positionIndex1, positionIndex2, positionIndex3]
        const face2 = [positionIndex2, positionIndex4, positionIndex3]
        indexArr.push(...face1, ...face2)
      }
    }
    this.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(indexArr), 1))
  }
}

export default EarthGeometry