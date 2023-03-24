import { Features } from 'src/types'
import * as THREE from 'three'
import BeforeLayerManager from './BeforeLayerManager'

/**
 * 显示最上层的 layer，如 TextLayer
 */
abstract class BaseBeforeLayer<
  Source extends Features = Features,
  Style extends {} = {},
> extends THREE.EventDispatcher {
  beforeLayerManager?: BeforeLayerManager
  source: Source
  style?: Style
  zIndex = 0
  readonly canvas = document.createElement('canvas')
  protected readonly ctx = this.canvas.getContext('2d')!

  constructor(options: { source: Source; style?: Style }) {
    super()

    this.source = options.source
    if (options.style) this.style = options.style

    this.canvas.style.position = 'absolute'
    this.canvas.style.inset = '0'
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

  abstract refresh(): void
}

export default BaseBeforeLayer
