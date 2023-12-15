import { BBox, TileBoxWithZ } from '../types'
import CanvasLayer from './CanvasLayer'
import * as THREE from 'three'
import Map from '../Map'
import MercatorTile from '../utils/MercatorTile'
import { getOverlapTileBox } from '../utils/tile'
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
  tileBoxes: TileBoxWithZ[] = []
  private bboxes: BBox[] = []
  canvasOptions: CanvasOption[] = []
  sortedLayers: CanvasLayer[] = []
  updating = false
  needsUpdate = true

  constructor(map: Map) {
    super()

    this.map = map
  }

  private updateTileBox() {
    const { tileSize, earthOrbitControls, displayTileBoxChange, displayTileBox } = this.map
    if (!displayTileBoxChange) return

    const { center } = earthOrbitControls
    const [centerX, centerY] = MercatorTile.pointToTile(center[0], center[1], displayTileBox.z)
    const maxTileCount = 8192 / tileSize

    const tileBoxes: TileBoxWithZ[] = []
    let overlapTileBox: TileBoxWithZ | null = null
    let i = 0
    while (!isEqual(overlapTileBox, displayTileBox) && i < 10) {
      const splitMaxTileCount = maxTileCount * Math.pow(2, i)
      i++

      const splitTileBox: TileBoxWithZ = {
        startX: centerX - splitMaxTileCount,
        startY: centerY - splitMaxTileCount,
        endX: centerX + splitMaxTileCount,
        endY: centerY + splitMaxTileCount,
        z: displayTileBox.z,
      }
      overlapTileBox = getOverlapTileBox(splitTileBox, displayTileBox)
      if (overlapTileBox) tileBoxes.push(overlapTileBox)
    }

    this.tileBoxes = tileBoxes
    this.bboxes = tileBoxes.map(v => MercatorTile.tileBoxToBBox(v, v.z))
    this.sortedLayers.forEach(layer => {
      layer.updateCanvasLayerMaterials(this.bboxes)
    })

    this.needsUpdate = true
  }

  update() {
    this.updateTileBox()

    if (this.updating) return
    this.updating = true

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

    const promises = this.sortedLayers.map(async layer => await layer.update())

    Promise.allSettled(promises).finally(() => {
      this.updating = false
    })
    this.needsUpdate = false
  }

  private onLayersChange() {
    this.map.tileGroup.resetMaterial()
  }

  private sortLayers() {
    this.sortedLayers = this.layers.sort((v1, v2) => v1.zIndex - v2.zIndex)
    this.onLayersChange()
  }

  addLayer(layer: CanvasLayer) {
    layer.layerManager = this
    layer.updateCanvasLayerMaterials(this.bboxes)
    layer.needsUpdate = true
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
