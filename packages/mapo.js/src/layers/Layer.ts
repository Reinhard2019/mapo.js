import * as THREE from 'three'
import LayerManager from './LayerManager'

abstract class Layer extends THREE.EventDispatcher {
  disposeFuncList: Array<() => void> = []
  layerManager?: LayerManager
  imageBitmap?: ImageBitmap
  zIndex = 0

  abstract update (): void

  dispose () {
    this.disposeFuncList.forEach(func => func())
    this.disposeFuncList = []
  }
}

export default Layer
