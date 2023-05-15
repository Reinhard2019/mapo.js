import * as THREE from 'three'
import TileGeometry from './TileGeometry'
import { toArray } from './utils/array'

class TileMesh extends THREE.Mesh {
  declare geometry: TileGeometry

  constructor(geometry: TileGeometry, material: THREE.Material | THREE.Material[]) {
    super(geometry, material)

    toArray(material).forEach((_, i) => {
      geometry.addGroup(0, Infinity, i)
    })
  }
}

export default TileMesh
