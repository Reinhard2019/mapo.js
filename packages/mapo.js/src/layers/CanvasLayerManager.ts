import { BBox } from '../types'
import CanvasLayer from './CanvasLayer'
import * as THREE from 'three'
import Map from 'src/Map'

export interface CanvasOption {
  pxDeg: number
  bbox: BBox
  width: number
  height: number
}

interface CanvasLayerManagerEvent {
  layersChange: {}
}

class CanvasLayerManager extends THREE.EventDispatcher<CanvasLayerManagerEvent> {
  readonly map: Map
  private readonly layers: CanvasLayer[] = []
  canvasOptionDict: {
    [z in string]: CanvasOption
  } = {}

  sortedLayers: CanvasLayer[] = []

  constructor(map: Map) {
    super()

    this.map = map
  }

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

  update() {
    this.layers.forEach(layer => {
      layer.update()
    })
  }

  sortLayers() {
    this.sortedLayers = this.layers.sort((v1, v2) => v1.zIndex - v2.zIndex)
    this.dispatchEvent({
      type: 'layersChange',
    })
  }

  addLayer(layer: CanvasLayer) {
    layer.layerManager = this
    layer.update()
    this.layers.push(layer)
    this.sortLayers()
  }

  removeLayer(layer: CanvasLayer) {
    const index = this.layers.findIndex(l => l === layer)
    this.layers.splice(index, 1)
    this.sortLayers()
  }
}

export default CanvasLayerManager
