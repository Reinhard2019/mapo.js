import Layer from '../Layer'
import TileLayerWorker from './TileLayerWorker'

class TileLayer extends Layer {
  private readonly worker = new TileLayerWorker()
  private readonly tileSize: number
  private readonly canvas = new OffscreenCanvas(0, 0)

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

  // TODO bbox 为 [-180, -90, 180, 90] 时，按瓦片离当前摄像机所处的经纬度的远近来加载图片，越近越优先加载
  update () {
    const { tileSize, canvas } = this
    const { bbox, z, displayBBox } = this.layerManager
    this.worker.postMessage({
      type: 'update',
      canvas,
      tileSize,
      z,
      bbox,
      displayBBox
    }, [canvas])
  }

  dispose () {
    super.dispose()
    this.worker.terminate()
  }
}

export default TileLayer
