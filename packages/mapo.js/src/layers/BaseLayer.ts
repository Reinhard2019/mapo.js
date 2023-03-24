import { Features } from 'src/types'
import * as THREE from 'three'
import LayerManager from './LayerManager'

abstract class BaseLayer<
  Source extends Features = Features,
  Style extends {} = {},
> extends THREE.EventDispatcher {
  disposeFuncList: Array<() => void> = []
  source: Source
  style?: Style
  layerManager?: LayerManager
  imageBitmap?: ImageBitmap
  zIndex = 0

  constructor(options: { source: Source; style?: Style }) {
    super()

    this.source = options.source
    if (options.style) this.style = options.style
  }

  abstract refresh(): void

  updateStyle(style: Style) {
    this.style = {
      ...this.style,
      ...style,
    }
  }

  setSource(source: Source) {
    this.source = source
  }

  update() {}

  dispose() {
    this.disposeFuncList.forEach(func => func())
    this.disposeFuncList = []
  }
}

export default BaseLayer
