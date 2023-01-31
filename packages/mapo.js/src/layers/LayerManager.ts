import { EventDispatcher } from 'three'
import { BBox } from '../types'
import Layer from './Layer'

class LayerManager extends EventDispatcher {
  readonly canvas = document.createElement('canvas')
  private readonly ctx: CanvasRenderingContext2D
  private readonly layers: Layer[] = []
  bbox: BBox = [-180, -90, 180, 90]
  /**
   * 当前实际显示区域的 BBox，只会比 bbox 更小
   */
  displayBBox: BBox = [-180, -90, 180, 90]
  z = 0

  constructor () {
    super()
    const { canvas } = this
    this.ctx = canvas.getContext('2d')
  }

  update () {
    const { ctx, canvas } = this
    this.layers.sort((v1, v2) => v1.zIndex - v2.zIndex).forEach(layer => {
      layer.imageBitmap && ctx.drawImage(layer.imageBitmap, 0, 0, canvas.width, canvas.height)
    })
    this.dispatchEvent({ type: 'update' })
  }

  addLayer (layer: Layer) {
    const update = this.update.bind(this)
    layer.addEventListener('update', update)
    layer.disposeFuncList.push(() => layer.removeEventListener('update', update))

    layer.layerManager = this
    layer.update()
    this.layers.push(layer)
  }

  removeLayer (layer: Layer) {
    const index = this.layers.findIndex(l => l === layer)
    this.layers.splice(index, 1)
    layer.dispose()
  }

  dispose () {
    this.layers.forEach(layer => layer.dispose())
  }
}

export default LayerManager
