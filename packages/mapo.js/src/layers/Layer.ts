import * as THREE from 'three'
import LayerManager from './LayerManager'

abstract class Layer extends THREE.EventDispatcher {
  disposeFuncList: Array<() => void> = []
  layerManager?: LayerManager
  imageBitmap?: ImageBitmap
  zIndex = 0

  abstract refresh (): void

  update () {}

  dispose () {
    this.disposeFuncList.forEach(func => func())
    this.disposeFuncList = []
  }
}

export default Layer
