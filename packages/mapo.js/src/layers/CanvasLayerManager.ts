import { isEmpty } from 'lodash-es'
import { BBox } from '../types'
import { fullBBox } from '../utils/bbox'
import CanvasLayer from './CanvasLayer'

class CanvasLayerManager {
  readonly canvas = document.createElement('canvas')
  private readonly ctx = this.canvas.getContext('2d')!
  private readonly layers: CanvasLayer[] = []
  bbox: BBox = fullBBox
  z = 0
  onUpdate?: () => void

  updateCanvasSize(pxDeg: number) {
    const { bbox, canvas } = this
    canvas.width = Math.ceil((bbox[2] - bbox[0]) / pxDeg)
    canvas.height = Math.ceil((bbox[3] - bbox[1]) / pxDeg)
  }

  update() {
    const { ctx, canvas } = this
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.layers
      .sort((v1, v2) => v1.zIndex - v2.zIndex)
      .forEach(layer => {
        layer.imageBitmap && ctx.drawImage(layer.imageBitmap, 0, 0, canvas.width, canvas.height)
      })
    this.onUpdate?.()
  }

  /**
   * 触发所有子 layer 的重渲染
   */
  updateLayers() {
    if (isEmpty(this.layers)) {
      return
    }

    this.layers.forEach(layer => {
      layer.update()
    })
    this.update()
  }

  addLayer(layer: CanvasLayer) {
    layer.layerManager = this
    layer.update()
    this.layers.push(layer)
    this.update()
  }

  removeLayer(layer: CanvasLayer) {
    const index = this.layers.findIndex(l => l === layer)
    this.layers.splice(index, 1)
    this.update()
  }
}

export default CanvasLayerManager
