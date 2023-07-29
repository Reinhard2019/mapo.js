import { BBox, Features } from 'src/types'
import Layer from './Layer'
// import CanvasLayerManager from './CanvasLayerManager'

abstract class CanvasLayer<Source extends Features = Features, Style extends {} = {}> extends Layer<
  Source,
  Style
> {
  // layerManager?: CanvasLayerManager
  readonly canvasArr: OffscreenCanvas[] = [new OffscreenCanvas(1, 1)]
  _extraLayerOptions: Array<{ bbox: BBox; pxDeg: number; canvasSize: [number, number] }>
  // protected readonly canvas = new OffscreenCanvas(1, 1)
  // protected readonly ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D

  get extraLayerOptions() {
    return this._extraLayerOptions
  }

  set extraLayerOptions(value) {
    this._extraLayerOptions = value

    value.forEach((option, i) => {
      const canvas = this.canvasArr[i] ?? new OffscreenCanvas(1, 1)
      const { bbox, pxDeg } = option
      canvas.width = Math.ceil((bbox[2] - bbox[0]) / pxDeg)
      canvas.height = Math.ceil((bbox[3] - bbox[1]) / pxDeg)
    })
  }

  abstract draw(options: { bbox: BBox; pxDeg: number; canvas: OffscreenCanvas }): void

  update() {
    const { canvasArr, extraLayerOptions } = this

    extraLayerOptions.forEach((option, i) => {
      const canvas = canvasArr[i] ?? (canvasArr[i] = new OffscreenCanvas(1, 1))
      canvas.width = option.canvasSize[0]
      canvas.height = option.canvasSize[1]
      this.draw({
        ...option,
        canvas,
      })
    })
  }
}

export default CanvasLayer
