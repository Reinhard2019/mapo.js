import * as THREE from 'three'
import TileGeometry from './TileGeometry'
import { last, toArray } from './utils/array'
import TileMaterial from './TileMaterial'
import { XYZ } from './types'
import TileGroup from './TileGroup'
import { getOverlapTileBox, tileBoxContain, tileBoxOverlap, xyzToTileBox } from './utils/tile'

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
    const { tileBoxes } = canvasLayerManager

    let start = 0
    let end = 1
    if (tileBoxes.length > 1) {
      const maxTileBox = last(tileBoxes)!
      const currentTileBox = xyzToTileBox(this.xyz)
      const overlapTileBox = getOverlapTileBox(currentTileBox, maxTileBox)!
      if (!overlapTileBox) return

      for (let i = 0; i < tileBoxes.length; i++) {
        const tileBox = tileBoxes[i]
        if (!tileBoxOverlap(tileBox, overlapTileBox)) {
          start = i + 1
        } else if (tileBoxContain(tileBox, overlapTileBox) || i === tileBoxes.length - 1) {
          end = i + 1
          break
        }
      }
    }

    this.material = [
      this.tileMaterial,
      ...canvasLayerManager.sortedLayers.flatMap(layer =>
        layer.canvasLayerMaterials.slice(start, end),
      ),
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
