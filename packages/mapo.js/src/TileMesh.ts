import * as THREE from 'three'
import TileGeometry from './TileGeometry'
import { last, toArray } from './utils/array'
import TileMaterial from './TileMaterial'
import { XYZ } from './types'
import TileGroup from './TileGroup'
import { getSatelliteUrl } from './utils/map'
import { getOverlapTileBox, tileBoxContain, tileBoxOverlap, xyzToTileBox } from './utils/tile'

class TileMesh extends THREE.Mesh {
  declare geometry: TileGeometry

  private readonly tileGroup: TileGroup
  private tileMaterial: TileMaterial
  readonly xyz: XYZ

  promise: Promise<unknown> | undefined
  tileMaterialLoaded = false

  constructor(xyz: XYZ, tileGroup: TileGroup) {
    super()

    this.xyz = xyz
    this.renderOrder = xyz[2]
    this.tileGroup = tileGroup

    this.geometry = new TileGeometry({
      tileMesh: this,
      tileGroup,
    })

    this.setPromise()
  }

  private setPromise() {
    const { tileSize } = this.tileGroup.map
    const { xyz } = this

    const url = getSatelliteUrl(this.xyz)
    this.promise = new THREE.ImageBitmapLoader()
      .loadAsync(url)
      .then(image => {
        this.tileMaterial = new TileMaterial({ xyz, image, tileSize })
        this.tileMaterialLoaded = true
      })
      .catch(() => {
        this.promise = undefined
      })
  }

  /**
   * Mesh 出现在可视范围内调用
   */
  show() {
    // 处理加载失败的情况
    if (!this.promise) {
      this.setPromise()
    }

    void this.promise?.then(() => this.resetMaterial())

    this.geometry.resetTerrain()
  }

  resetMaterial() {
    const { canvasLayerManager } = this.tileGroup
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
    this.material && toArray(this.material).forEach(m => m.dispose())
  }
}

export default TileMesh
