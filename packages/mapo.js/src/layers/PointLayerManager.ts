import * as THREE from 'three'
import PointLayer from './PointLayer'
import Map from 'src/Map'

class PointLayerManager extends THREE.Group {
  declare children: PointLayer[]

  readonly map: Map

  constructor(map: Map) {
    super()

    this.map = map
  }

  addLayer(layer: PointLayer) {
    layer.setPointLayerManager(this)
    layer.refresh()
    this.add(layer)
  }

  removeLayer(layer: PointLayer) {
    this.remove(layer)
  }

  refresh() {
    this.children.forEach(child => {
      child.refresh()
    })
  }
}

export default PointLayerManager
