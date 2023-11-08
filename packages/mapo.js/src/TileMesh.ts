import * as THREE from 'three'
import TileGeometry from './TileGeometry'
import { toArray } from './utils/array'
import TileMaterial from './TileMaterial'
import CanvasLayerManager from './layers/CanvasLayerManager'

class TileMesh extends THREE.Mesh {
  declare geometry: TileGeometry
  private readonly tileMaterial
  private readonly canvasLayerManager: CanvasLayerManager

  constructor(
    geometry: TileGeometry,
    tileMaterial: TileMaterial,
    canvasLayerManager: CanvasLayerManager,
  ) {
    super(geometry)

    this.tileMaterial = tileMaterial
    this.canvasLayerManager = canvasLayerManager

    this.resetMaterial()

    canvasLayerManager.addEventListener('layersChange', () => {
      this.resetMaterial()
    })
  }

  private resetMaterial() {
    const [, , z] = this.geometry.xyz
    this.material = [
      this.tileMaterial,
      ...this.canvasLayerManager.sortedLayers.map(layer => layer.getCanvasLayerMaterial(z)),
    ]
    this.resetGroups()
  }

  private resetGroups() {
    this.geometry.clearGroups()
    toArray(this.material).forEach((_, i) => {
      this.geometry.addGroup(0, Infinity, i)
    })
  }
}

export default TileMesh
