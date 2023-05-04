import { Features } from 'src/types'
import * as THREE from 'three'

abstract class Layer<
  Source extends Features = Features,
  Style extends {} = {},
> extends THREE.EventDispatcher {
  source: Source
  style?: Style | undefined
  zIndex = 0

  constructor(options: { source: Source; style?: Style }) {
    super()

    this.source = options.source
    this.style = options.style
  }

  updateStyle(style: Style) {
    this.style = {
      ...this.style,
      ...style,
    }
  }

  setSource(source: Source) {
    this.source = source
  }

  abstract update(): void
}

export default Layer
