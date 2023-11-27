import * as THREE from 'three'
import TileGeometry from './TileGeometry'
import { toArray } from './utils/array'
import TileMaterial from './TileMaterial'
import { XYZ } from './types'
import TileGroup from './TileGroup'
import { getSatelliteUrl } from './utils/map'

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
    const { canvasLayerManager } = this.tileGroup
    const { tileSize } = this.tileGroup.map
    const { xyz } = this

    const url = getSatelliteUrl(this.xyz)
    this.promise = new THREE.ImageBitmapLoader()
      .loadAsync(url)
      .then(image => {
        this.tileMaterial = new TileMaterial({ xyz, image, tileSize })
        this.resetMaterial()
        this.tileMaterialLoaded = true

        canvasLayerManager.addEventListener('layersChange', () => {
          this.resetMaterial()
        })
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

    this.geometry.resetTerrain()
  }

  private resetMaterial() {
    const { canvasLayerManager } = this.tileGroup
    this.material = [this.tileMaterial, ...canvasLayerManager.canvasLayerMaterials]
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
