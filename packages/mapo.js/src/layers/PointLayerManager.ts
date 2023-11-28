import * as THREE from 'three'
import PointLayer from './PointLayer'
import Map from '../Map'

class PointLayerManager extends THREE.Group {
  readonly map: Map
  private pointLayers: PointLayer[] = []

  constructor(map: Map) {
    super()

    this.map = map
  }

  addLayer(layer: PointLayer) {
    layer.setPointLayerManager(this)
    layer.update()
    this.pointLayers.push(layer)
    this.add(layer.group)
  }

  removeLayer(layer: PointLayer) {
    this.pointLayers = this.pointLayers.filter(l => l !== layer)
    this.remove(layer.group)
  }

  update() {
    this.pointLayers.forEach(child => {
      child.update()
    })
  }
}

export default PointLayerManager
