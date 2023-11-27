import { BBox, TileBoxWithZ } from '../types'
import CanvasLayer from './CanvasLayer'
import * as THREE from 'three'
import Map from 'src/Map'
import MercatorTile from 'src/utils/MercatorTile'
import CanvasLayerMaterial from 'src/CanvasLayerMaterial'
import { getOverlapTileBox } from 'src/utils/tile'
import { isEqual } from 'lodash-es'

interface CanvasOption {
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
  private bboxes: BBox[] = []
  canvasLayerMaterials: CanvasLayerMaterial[] = []
  canvasOptions: CanvasOption[] = []

  sortedLayers: CanvasLayer[] = []

  constructor(map: Map) {
    super()

    this.map = map
  }

  updateTileBox(tileBox: TileBoxWithZ) {
    const { tileSize, earthOrbitControls } = this.map
    const { center } = earthOrbitControls
    const [centerX, centerY] = MercatorTile.pointToTile(center[0], center[1], tileBox.z)
    const maxTileCount = 8192 / tileSize

    const tileBoxes: TileBoxWithZ[] = []
    let overlapTileBox: TileBoxWithZ | null = null
    let i = 0
    while (!isEqual(overlapTileBox, tileBox) && i < 10) {
      const splitMaxTileCount = maxTileCount * Math.pow(2, i)
      i++

      const splitTileBox: TileBoxWithZ = {
        startX: centerX - splitMaxTileCount,
        startY: centerY - splitMaxTileCount,
        endX: centerX + splitMaxTileCount,
        endY: centerY + splitMaxTileCount,
        z: tileBox.z,
      }
      overlapTileBox = getOverlapTileBox(splitTileBox, tileBox)
      if (overlapTileBox) tileBoxes.push(overlapTileBox)
    }

    this.bboxes = tileBoxes.map(v => MercatorTile.tileBoxToBBox(v, v.z))
    this.sortedLayers.forEach(layer => {
      layer.updateCanvasLayerMaterials(this.bboxes)
    })
    this.onLayersChange()
  }

  update() {
    const { earthOrbitControls } = this.map
    let { zoom } = earthOrbitControls
    this.canvasOptions = this.bboxes.map(bbox => {
      const pxDeg = earthOrbitControls.getPxDeg(zoom)
      zoom--
      const width = Math.ceil((bbox[2] - bbox[0]) / pxDeg)
      const height = Math.ceil((bbox[3] - bbox[1]) / pxDeg)

      return {
        bbox,
        width,
        height,
        pxDeg,
      }
    })

    this.sortedLayers.forEach(layer => {
      layer.update()
    })
  }

  private onLayersChange() {
    this.canvasLayerMaterials = this.sortedLayers.flatMap(layer => layer.canvasLayerMaterials)
    this.dispatchEvent({
      type: 'layersChange',
    })
  }

  private sortLayers() {
    this.sortedLayers = this.layers.sort((v1, v2) => v1.zIndex - v2.zIndex)
    this.onLayersChange()
  }

  addLayer(layer: CanvasLayer) {
    layer.layerManager = this
    layer.updateCanvasLayerMaterials(this.bboxes)
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
