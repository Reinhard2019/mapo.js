/**
 * 瓦片加载器
 * !!! 会用于 Web Worker
 */
import EquirectangularTile from '../../tiles/EquirectangularTile'
import MercatorTile from '../../tiles/MercatorTile'
import { XYZ } from '../../types'
import { getSatelliteUrl } from '../../utils/map'
import { chunk, slice } from '../../utils/array'
import { clamp } from '../../utils/number'
import { equirectangularY2mercatorY, mercatorY2equirectangularY } from '../../utils/tile'
import TileCache from './TileCache'

class TileLoader {
  static workerScripts = [equirectangularY2mercatorY, mercatorY2equirectangularY, getSatelliteUrl, TileCache, clamp, chunk, slice, MercatorTile, EquirectangularTile, TileLoader]

  private readonly cache = new TileCache()

  getCacheTile (xyz: XYZ) {
    return this.cache.get(xyz)
  }

  async loadTile (xyz: XYZ, tileSize: number) {
    const [_, y, z] = xyz

    const item = this.cache.get(xyz)
    if (item) {
      return await item
    }

    const promise = fetch(getSatelliteUrl(...xyz)).then(async (res) => {
      const imageBitmap = await createImageBitmap(await res.blob())

      const startEquirectangularPixelY = Math.round(mercatorY2equirectangularY(y, z) * tileSize)
      const endEquirectangularPixelY = Math.round(mercatorY2equirectangularY(y + 1, z) * tileSize)
      const imgHeight = endEquirectangularPixelY - startEquirectangularPixelY

      const canvas = new OffscreenCanvas(tileSize, tileSize)
      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
      ctx.drawImage(imageBitmap, 0, 0, tileSize, tileSize)
      const mercatorImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      const pixelLineList = chunk(mercatorImageData.data, tileSize * 4)
      const equirectangularData = Array(imgHeight).fill(0).flatMap((__, i) => {
        const equirectangularY = (startEquirectangularPixelY + i) / tileSize
        const mercatorPixelY = equirectangularY2mercatorY(equirectangularY, z) * tileSize
        return pixelLineList[Math.round(clamp(mercatorPixelY, y * tileSize, (y + 1) * tileSize)) % tileSize]
      })
      const imageData = new ImageData(new Uint8ClampedArray(equirectangularData), tileSize, imgHeight)
      return await createImageBitmap(imageData).then(value => {
        this.cache.set(xyz, value)
        return value
      })
    })
    this.cache.set(xyz, promise)
    promise.catch(() => {
      this.cache.delete(xyz)
    })

    return await promise
  }
}

export default TileLoader
