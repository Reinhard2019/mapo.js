import * as THREE from 'three'
import TileGeometry from './TileGeometry'
import { toArray } from './utils/array'
import TileMaterial from './TileMaterial'
import { XYZ } from './types'
import TileGroup from './TileGroup'

class TileMesh extends THREE.Mesh {
  declare geometry: TileGeometry

  private readonly tileGroup: TileGroup
  private readonly tileMaterial: TileMaterial
  readonly xyz: XYZ

  constructor(xyz: XYZ, tileGroup: TileGroup) {
    super()

    this.xyz = xyz
    this.renderOrder = xyz[2]
    this.tileGroup = tileGroup
    this.tileMaterial = new TileMaterial({ xyz })

    this.geometry = new TileGeometry({
      tileGroup,
      xyz: this.xyz,
    })
  }

  /**
   * Mesh 出现在可视范围内调用
   */
  show() {
    void this.load()

    this.resetMaterial()

    this.geometry.resetTerrain()
  }

  async load() {
    return await this.tileMaterial.load()
  }

  resetMaterial() {
    const { canvasLayerManager } = this.tileGroup.map

    this.material = [
      this.tileMaterial,
      ...canvasLayerManager.getCanvasLayerMaterialsOfTile(this.xyz),
    ]
    this.resetGroups()
  }

  private resetGroups() {
    this.geometry.clearGroups()
    toArray(this.material).forEach((_, i) => {
      this.geometry.addGroup(0, Infinity, i)
    })
  }

  dispose() {
    this.geometry.dispose()
    this.tileMaterial.dispose()
  }
}

export default TileMesh
