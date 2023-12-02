import { BBox, Features } from '../types'
import CanvasLayerManager from './CanvasLayerManager'
import CanvasLayerMaterial from '../CanvasLayerMaterial'
import geoEquirectangular from '../utils/geoEquirectangular'

export interface DrawOption {
  bbox: BBox
  pxDeg: number
  ctx: OffscreenCanvasRenderingContext2D
}

abstract class CanvasLayer<Source extends Features = Features, Style extends {} = {}> {
  source: Source
  style?: Style | undefined
  zIndex = 0

  layerManager: CanvasLayerManager
  canvasLayerMaterials: CanvasLayerMaterial[] = []
  needsUpdate = true

  constructor(options: { source: Source; style?: Style }) {
    this.source = options.source
    this.style = options.style
  }

  updateStyle(style: Style) {
    this.style = {
      ...this.style,
      ...style,
    }
    this.needsUpdate = true
  }

  setSource(source: Source) {
    this.source = source
    this.needsUpdate = true
  }

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
    this.canvasLayerMaterials.forEach((canvasLayerMaterial, i) => {
      const prevBBox = i === 0 ? undefined : bboxes[i - 1]
      canvasLayerMaterial.updatePrevBBox(prevBBox)
    })
  }

  getProjection(drawOptions: DrawOption) {
    const { bbox, ctx } = drawOptions
    return geoEquirectangular({
      bbox,
      size: [ctx.canvas.width, ctx.canvas.height],
    })
  }

  update() {
    const { layerManager } = this
    if (!layerManager) return

    if (!layerManager.needsUpdate && !this.needsUpdate) return
    this.needsUpdate = false

    const { canvasOptions } = layerManager
    const { taskQueue } = layerManager.map

    canvasOptions.forEach((canvasOption, i) => {
      taskQueue.add(() => {
        console.time(this.constructor.name)
        const canvasLayerMaterial = this.canvasLayerMaterials[i]
        if (!canvasLayerMaterial) return

        canvasLayerMaterial.updateCanvasOption(canvasOption)
        const { canvas, ctx } = canvasLayerMaterial
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const drawOption: DrawOption = {
          ...canvasOption,
          ctx,
        }
        this.draw(drawOption)

        canvasLayerMaterial.update()
        console.timeEnd(this.constructor.name)
      })
    })
  }

  abstract draw(options: DrawOption): void
}

export default CanvasLayer
