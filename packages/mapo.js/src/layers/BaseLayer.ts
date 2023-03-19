import { Features } from 'src/types'
import * as THREE from 'three'
import LayerManager from './LayerManager'

abstract class BaseLayer<S extends Features = Features> extends THREE.EventDispatcher {
  disposeFuncList: Array<() => void> = []
  source: S
  layerManager?: LayerManager
  imageBitmap?: ImageBitmap
  zIndex = 0

  abstract refresh(): void

  setSource(source: S) {
    this.source = source
  }

  update() {}

  dispose() {
    this.disposeFuncList.forEach(func => func())
    this.disposeFuncList = []
  }
}

export default BaseLayer
