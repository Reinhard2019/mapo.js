import * as THREE from 'three'
import BeforeLayerManager from './BeforeLayerManager'

/**
 * 显示最上层的 layer，如 TextLayer
 */
abstract class BaseBeforeLayer extends THREE.EventDispatcher {
  beforeLayerManager?: BeforeLayerManager
  zIndex = 0
  readonly canvas = document.createElement('canvas')
  protected readonly ctx = this.canvas.getContext('2d')!

  constructor() {
    super()

    this.canvas.style.position = 'absolute'
    this.canvas.style.inset = '0'
  }

  abstract refresh(): void
}

export default BaseBeforeLayer
