import { isEmpty } from 'lodash-es'
import { BBox } from '../types'
// import { fullBBox } from '../utils/bbox'
import CanvasLayer from './CanvasLayer'

class CanvasLayerManager {
  // readonly canvas = new OffscreenCanvas(1, 1)
  // private readonly ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  private readonly layers: CanvasLayer[] = []
  // bbox: BBox = fullBBox
  /**
   * 一个像素对应的经纬度
   */
  // private _pxDeg = 0
  canvasArr: OffscreenCanvas[] = []
  onUpdate?: () => void
  _extraLayerOptions: Array<{
    z: number
    pxDeg: number
    bbox: BBox
  }> = []

  // get pxDeg() {
  //   return this._pxDeg
  // }

  // set pxDeg(value) {
  //   this._pxDeg = value

  //   const { bbox, canvas } = this
  //   canvas.width = Math.ceil((bbox[2] - bbox[0]) / value)
  //   canvas.height = Math.ceil((bbox[3] - bbox[1]) / value)
  //   console.log('pxDeg', canvas.width, canvas.height, this._pxDeg)
  // }

  get extraLayerOptions() {
    return this._extraLayerOptions
  }

  set extraLayerOptions(value) {
    this._extraLayerOptions = value

    value.forEach((option, i) => {
      const canvas = this.canvasArr[i] ?? (this.canvasArr[i] = new OffscreenCanvas(1, 1))
      const { bbox, pxDeg } = option
      canvas.width = Math.ceil((bbox[2] - bbox[0]) / pxDeg)
      canvas.height = Math.ceil((bbox[3] - bbox[1]) / pxDeg)
    })

    this.layers.forEach(layer => {
      layer.extraLayerOptions = this.extraLayerOptions.map((option, i) => ({
        ...option,
        canvasSize: [this.canvasArr[i].width, this.canvasArr[i].height],
      }))
    })
  }

  update() {
    this.canvasArr.forEach((canvas, i) => {
      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
      const rect = [0, 0, canvas.width, canvas.height] as const
      ctx.clearRect(...rect)
      this.layers
        .sort((v1, v2) => v1.zIndex - v2.zIndex)
        .forEach(layer => {
          if (layer.canvasArr[0]) {
            const imageBitmap = layer.canvasArr[i].transferToImageBitmap()
            ctx.drawImage(imageBitmap, ...rect)
          }
        })
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
    layer.extraLayerOptions = this.extraLayerOptions.map((option, i) => ({
      ...option,
      canvasSize: [this.canvasArr[i].width, this.canvasArr[i].height],
    }))
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
