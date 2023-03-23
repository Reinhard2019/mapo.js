import { isEmpty } from 'lodash-es'
import { BBox } from '../types'
import { fullBBox } from '../utils/bbox'
import BaseLayer from './BaseLayer'

class LayerManager {
  // readonly canvas = new OffscreenCanvas(1, 1)
  // private readonly ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  readonly canvas = document.createElement('canvas')
  private readonly ctx = this.canvas.getContext('2d')!
  private readonly layers: BaseLayer[] = []
  bbox: BBox = fullBBox
  /**
   * 当前实际显示区域的 BBox，只会比 bbox 更小
   */
  displayBBox: BBox = fullBBox
  z = 0
  onUpdate?: () => void

  updateCanvasSize(pxDeg: number) {
    const { bbox, canvas } = this
    canvas.width = Math.ceil((bbox[2] - bbox[0]) / pxDeg)
    canvas.height = Math.ceil((bbox[3] - bbox[1]) / pxDeg)
  }

  updateCanvas() {
    const { ctx, canvas } = this
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.layers
      .sort((v1, v2) => v1.zIndex - v2.zIndex)
      .forEach(layer => {
        layer.imageBitmap && ctx.drawImage(layer.imageBitmap, 0, 0, canvas.width, canvas.height)
      })
    this.onUpdate?.()
  }

  refresh() {
    if (isEmpty(this.layers)) {
      return
    }

    this.layers.forEach(layer => {
      layer.refresh()
    })
    this.updateCanvas()
  }

  update() {
    this.layers.forEach(layer => {
      layer.update()
    })
  }

  addLayer(layer: BaseLayer) {
    layer.layerManager = this
    this.layers.push(layer)
    layer.refresh()
    this.updateCanvas()
  }

  removeLayer(layer: BaseLayer) {
    const index = this.layers.findIndex(l => l === layer)
    this.layers.splice(index, 1)
    layer.dispose()
    this.updateCanvas()
  }

  dispose() {
    this.layers.forEach(layer => layer.dispose())
  }
}

export default LayerManager
