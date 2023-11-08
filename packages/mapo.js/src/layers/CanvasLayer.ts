import { BBox, Features } from 'src/types'
import Layer from './Layer'
import CanvasLayerManager from './CanvasLayerManager'
import CanvasLayerMaterial from 'src/CanvasLayerMaterial'

export interface DrawOptions {
  bbox: BBox
  pxDeg: number
  ctx: OffscreenCanvasRenderingContext2D
}

abstract class CanvasLayer<Source extends Features = Features, Style extends {} = {}> extends Layer<
  Source,
  Style
> {
  layerManager: CanvasLayerManager
  canvasLayerMaterialDict: {
    [z in string]: CanvasLayerMaterial
  } = {}

  abstract draw(options: DrawOptions): void

  update() {
    const { canvasLayerMaterialDict } = this
    const canvasOptionDict = this.layerManager?.canvasOptionDict ?? {}

    Object.entries(canvasOptionDict).forEach(([z, canvasOption]) => {
      if (!canvasLayerMaterialDict[z]) {
        canvasLayerMaterialDict[z] = new CanvasLayerMaterial(canvasOption)
      }
      window.requestIdleCallback(() => {
        const canvasLayerMaterial = canvasLayerMaterialDict[z]
        canvasLayerMaterial.updateCanvasOption(canvasOption)
        const { canvas, ctx } = canvasLayerMaterial
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        this.draw({
          ...canvasOption,
          ctx,
        })
      })
    })
  }

  updateCanvasLayerMaterial() {
    Object.keys(this.layerManager?.canvasOptionDict).forEach(z => {
      this.canvasLayerMaterialDict[z]?.update()
    })
  }
}

export default CanvasLayer
