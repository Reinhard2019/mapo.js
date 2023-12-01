import { BBox, Features } from '../types'
import Layer from './Layer'
import CanvasLayerManager from './CanvasLayerManager'
import CanvasLayerMaterial from '../CanvasLayerMaterial'

export interface DrawOption {
  bbox: BBox
  pxDeg: number
  ctx: OffscreenCanvasRenderingContext2D
}

abstract class CanvasLayer<Source extends Features = Features, Style extends {} = {}> extends Layer<
  Source,
  Style
> {
  layerManager: CanvasLayerManager
  canvasLayerMaterials: CanvasLayerMaterial[] = []

  abstract draw(options: DrawOption): void

  updateCanvasLayerMaterials(bboxes: BBox[]) {
    if (this.canvasLayerMaterials.length > bboxes.length) {
      this.canvasLayerMaterials
        .slice(bboxes.length)
        .forEach(canvasLayerMaterial => canvasLayerMaterial.dispose())
      this.canvasLayerMaterials = this.canvasLayerMaterials.slice(0, bboxes.length)
    }
    this.canvasLayerMaterials = bboxes.map(
      (_, i) => this.canvasLayerMaterials[i] ?? new CanvasLayerMaterial(),
    )
  }

  projection(drawOptions: DrawOption, position: [number, number]) {
    const [w, s, e, n] = drawOptions.bbox
    const { width, height } = drawOptions.ctx.canvas

    const [lng, lat] = position
    const x = ((lng - w) / (e - w)) * width
    const y = ((n - lat) / (n - s)) * height
    return [x, y] as const
  }

  update() {
    const { layerManager } = this
    if (!layerManager) return

    const { canvasOptions } = layerManager
    const { taskQueue } = layerManager.map

    canvasOptions.forEach((canvasOption, i) => {
      taskQueue.add(this.constructor.name, () => {
        console.time(this.constructor.name)
        const canvasLayerMaterial = this.canvasLayerMaterials[i]
        canvasLayerMaterial.updateCanvasOption(canvasOption)
        const { canvas, ctx } = canvasLayerMaterial
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const drawOption: DrawOption = {
          ...canvasOption,
          ctx,
        }
        this.draw(drawOption)

        const prevCanvasOption = canvasOptions[i - 1]
        if (prevCanvasOption) {
          const [w, s, e, n] = prevCanvasOption.bbox
          const [left, top] = this.projection(drawOption, [w, n])
          const [right, bottom] = this.projection(drawOption, [e, s])
          ctx.clearRect(left, top, right, bottom)
        }

        canvasLayerMaterial.update()
        console.timeEnd(this.constructor.name)
      })
    })
  }
}

export default CanvasLayer
