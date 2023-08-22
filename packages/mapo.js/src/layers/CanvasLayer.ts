import { BBox, Features } from 'src/types'
import Layer from './Layer'
import CanvasLayerManager from './CanvasLayerManager'
import CanvasLayerMaterial from 'src/CanvasLayerMaterial'

abstract class CanvasLayer<Source extends Features = Features, Style extends {} = {}> extends Layer<
  Source,
  Style
> {
  private layerManager?: CanvasLayerManager
  canvasLayerMaterialDict: {
    [z in string]: CanvasLayerMaterial
  } = {}

  abstract draw(options: { bbox: BBox; pxDeg: number; canvas: OffscreenCanvas }): void

  setLayerManager(layerManager: CanvasLayerManager) {
    this.layerManager = layerManager
  }

  update() {
    const { canvasLayerMaterialDict } = this
    const canvasOptionDict = this.layerManager?.canvasOptionDict ?? {}

    Object.entries(canvasOptionDict).forEach(([z, canvasOption]) => {
      const { bbox, pxDeg } = canvasOption
      let canvasLayerMaterial = canvasLayerMaterialDict[z]
      if (canvasLayerMaterial) {
        canvasLayerMaterial.updateCanvasOption(canvasOption)
      } else {
        canvasLayerMaterial = canvasLayerMaterialDict[z] = new CanvasLayerMaterial(canvasOption)
      }
      window.requestIdleCallback(() => {
        this.draw({
          bbox,
          pxDeg,
          canvas: canvasLayerMaterial.canvas,
        })
        canvasLayerMaterial.update()
      })
    })
  }
}

export default CanvasLayer
