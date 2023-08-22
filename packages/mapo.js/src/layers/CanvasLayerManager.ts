import { isEmpty } from 'lodash-es'
import { BBox } from '../types'
import CanvasLayer from './CanvasLayer'
import * as THREE from 'three'

export interface CanvasOption {
  pxDeg: number
  bbox: BBox
  width: number
  height: number
}

interface CanvasLayerManagerEvent extends THREE.Event {
  type: 'layersChange'
}

class CanvasLayerManager extends THREE.EventDispatcher<CanvasLayerManagerEvent> {
  private readonly layers: CanvasLayer[] = []
  canvasOptionDict: {
    [z in string]: CanvasOption
  } = {}

  sortedLayers: CanvasLayer[] = []

  resetCanvasOptionDict() {
    this.canvasOptionDict = {}
  }

  addCanvasBBox(z: number, options: Pick<CanvasOption, 'pxDeg' | 'bbox'>) {
    const { pxDeg, bbox } = options
    const width = Math.ceil((bbox[2] - bbox[0]) / pxDeg)
    const height = Math.ceil((bbox[3] - bbox[1]) / pxDeg)

    this.canvasOptionDict[z] = {
      pxDeg,
      bbox,
      width,
      height,
    }
  }

  // getCanvasLayerMaterial(z: number) {
  //   if (!this.canvasLayerMaterials[z]) {
  //     this.canvasLayerMaterials[z] = new CanvasLayerMaterial({
  //       canvas: new OffscreenCanvas(1, 1),
  //       bbox: fullBBox,
  //     })
  //   }
  //   return this.canvasLayerMaterials[z]
  // }

  // updateCanvasBBox(z: number, bbox: BBox) {
  //   console.log('updateCanvasBBox', z, bbox)
  //   const { zoom, tileSize } = this.earthOrbitControls
  //   const pxDeg = 360 / (Math.pow(2, z + (zoom % 1)) * tileSize)
  //   const width = Math.ceil((bbox[2] - bbox[0]) / pxDeg)
  //   const height = Math.ceil((bbox[3] - bbox[1]) / pxDeg)
  //   const canvasLayerMaterial = this.getCanvasLayerMaterial(z)
  //   canvasLayerMaterial.canvas.width = width
  //   canvasLayerMaterial.canvas.height = height
  //   canvasLayerMaterial.bbox = bbox
  //   canvasLayerMaterial.pxDeg = pxDeg
  // }

  // update() {
  //   Object.entries(this.canvasLayerMaterials).forEach(([z, canvasLayerMaterial]) => {
  //     const { canvas } = canvasLayerMaterial
  //     const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  //     const rect = [0, 0, canvas.width, canvas.height] as const
  //     ctx.clearRect(...rect)
  //     this.layers
  //       .sort((v1, v2) => v1.zIndex - v2.zIndex)
  //       .forEach(layer => {
  //         const layerCanvas = layer.canvasDict[z]
  //         if (layerCanvas) {
  //           ctx.drawImage(layerCanvas, ...rect)
  //         }
  //       })
  //     canvasLayerMaterial.update()
  //   })
  // }

  update() {
    this.updateLayers()
  }

  sortLayers() {
    this.sortedLayers = this.layers.sort((v1, v2) => v1.zIndex - v2.zIndex)
    this.dispatchEvent({
      type: 'layersChange',
    })
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
  }

  addLayer(layer: CanvasLayer) {
    layer.setLayerManager(this)
    layer.update()
    this.layers.push(layer)
    this.sortLayers()
    // this.update()
  }

  removeLayer(layer: CanvasLayer) {
    const index = this.layers.findIndex(l => l === layer)
    this.layers.splice(index, 1)
    this.sortLayers()
    // this.update()
  }
}

export default CanvasLayerManager
