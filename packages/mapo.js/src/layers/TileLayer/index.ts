import Layer from '../Layer'
import TileLayerWorker from './TileLayerWorker'

class TileLayer extends Layer {
  private readonly worker = new TileLayerWorker()
  private readonly tileSize: number

  constructor (tileSize: number) {
    super()
    this.tileSize = tileSize

    const onmessage = (e: MessageEvent) => {
      if (e.data.type === 'update') {
        this.imageBitmap = e.data.imageBitmap
        this.dispatchEvent({ type: 'update' })
      }
    }
    this.worker.addEventListener('message', onmessage)
    this.disposeFuncList.push(() => this.worker.removeEventListener('message', onmessage))
  }

  async preload () {
    const { tileSize } = this
    return await this.worker.loadTile([0, 0, 0], tileSize)
  }

  refresh () {
    const { tileSize } = this
    const { bbox, z, displayBBox } = this.layerManager!
    this.worker.postMessage({
      type: 'refresh',
      tileSize,
      z,
      bbox,
      displayBBox
    })
  }

  update () {
    const { tileSize } = this
    const { bbox, z, displayBBox } = this.layerManager!

    this.worker.postMessage({
      type: 'update',
      tileSize,
      z,
      bbox,
      displayBBox
    })
  }

  dispose () {
    super.dispose()
    this.worker.terminate()
  }
}

export default TileLayer
