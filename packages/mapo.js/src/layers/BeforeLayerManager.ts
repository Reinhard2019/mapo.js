import { BBox } from '../types'
import { fullBBox } from '../utils/bbox'
import BaseBeforeLayer from './BaseBeforeLayer'
import EarthOrbitControls from '../EarthOrbitControls'
import Map from '../Map'

class BeforeLayerManager {
  private readonly layers: BaseBeforeLayer[] = []
  bbox: BBox = fullBBox
  /**
   * 当前实际显示区域的 BBox，只会比 bbox 更小
   */
  displayBBox: BBox = fullBBox
  z = 0
  onUpdate?: () => void
  readonly container: HTMLElement
  readonly map: Map
  readonly earthOrbitControls: EarthOrbitControls

  constructor(options: {
    container: HTMLElement
    map: Map
    earthOrbitControls: EarthOrbitControls
  }) {
    this.container = options.container
    this.map = options.map
    this.earthOrbitControls = options.earthOrbitControls
  }

  private updateLayerCanvasSize(layer: BaseBeforeLayer) {
    layer.canvas.width = this.container.clientWidth
    layer.canvas.height = this.container.clientHeight
  }

  refresh() {
    this.layers.forEach(layer => {
      this.updateLayerCanvasSize(layer)
      layer.refresh()
    })
  }

  addLayer(layer: BaseBeforeLayer) {
    layer.beforeLayerManager = this
    this.updateLayerCanvasSize(layer)
    layer.refresh()
    this.container.appendChild(layer.canvas)
    this.layers.push(layer)
  }

  removeLayer(layer: BaseBeforeLayer) {
    const index = this.layers.findIndex(l => l === layer)
    this.container.removeChild(layer.canvas)
    this.layers.splice(index, 1)
  }
}

export default BeforeLayerManager
