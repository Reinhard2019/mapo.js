import { isEqual } from 'lodash-es'
import { XYZ } from './types'
import TileCache from './utils/TileCache'
import { getTerrainUrl } from './utils/map'

interface MessageEventData {
  xyz: XYZ
  tileSize: number
}

interface OnMessageEventData {
  xyz: XYZ
  imageData: ImageData
}

async function onmessage(event: MessageEvent<MessageEventData>) {
  const { xyz, tileSize } = event.data
  const url = getTerrainUrl(...xyz)
  const resp = await fetch(url)
  const blob = await resp.blob()
  const imageBitmap = await createImageBitmap(blob)

  const canvas = new OffscreenCanvas(tileSize, tileSize)
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  // 部份瓦片存在一些多余的裙边
  const sx = (imageBitmap.width - tileSize) / 2
  const sy = (imageBitmap.height - tileSize) / 2
  ctx.drawImage(imageBitmap, sx, sy, tileSize, tileSize, 0, 0, tileSize, tileSize)
  const imageData = ctx.getImageData(0, 0, tileSize, tileSize)

  postMessage({
    xyz,
    imageData,
  } as OnMessageEventData)
}

const scripts = [getTerrainUrl]
const blob = new Blob([
  ...scripts.map(v => v.toString() + '\n\n').join(''),
  `onmessage = ${onmessage.toString()}`,
])

const workerUrl = URL.createObjectURL(blob)

class TerrainTileWorker extends Worker {
  tileCache = new TileCache<Promise<ImageData>>()

  constructor() {
    super(workerUrl)
  }

  postMessage(message: MessageEventData, ...argus) {
    super.postMessage(message, ...argus)
  }

  async loadTile(options: MessageEventData) {
    const tile = this.tileCache.get(options.xyz)
    if (tile) return await tile

    const promise = new Promise<ImageData>(resolve => {
      const onMessage = (e: MessageEvent<OnMessageEventData>) => {
        const { xyz, imageData } = e.data
        if (isEqual(xyz, options.xyz)) {
          resolve(imageData)
          this.removeEventListener('message', onMessage)
        }
      }
      this.addEventListener('message', onMessage)

      this.postMessage(options)
    })
    this.tileCache.set(options.xyz, promise)

    return await promise
  }
}

export default TerrainTileWorker
