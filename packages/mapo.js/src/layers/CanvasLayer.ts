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
  private canvasLayerMaterialDict: {
    [z in string]: CanvasLayerMaterial
  } = {}

  abstract draw(options: DrawOptions): void

  getCanvasLayerMaterial(z: number | string) {
    return (
      this.canvasLayerMaterialDict[z] ??
      (this.canvasLayerMaterialDict[z] = new CanvasLayerMaterial())
    )
  }

  update() {
    const canvasOptionDict = this.layerManager?.canvasOptionDict ?? {}

    Object.entries(canvasOptionDict).forEach(([z, canvasOption]) => {
      window.requestIdleCallback(() => {
        const canvasLayerMaterial = this.getCanvasLayerMaterial(z)
        canvasLayerMaterial.updateCanvasOption(canvasOption)
        const { canvas, ctx } = canvasLayerMaterial
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        this.draw({
          ...canvasOption,
          ctx,
        })

        this.canvasLayerMaterialDict[z]?.update()
      })
    })
  }
}

export default CanvasLayer
