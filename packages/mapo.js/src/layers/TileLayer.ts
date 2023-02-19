import { inRange, isNil, range } from 'lodash-es'
import MercatorTile from '../utils/MercatorTile'
import { BBox, XYZ } from '../types'
import { multiplyArray } from '../utils/array'
import { fullBBox } from '../utils/bbox'
import { getSatelliteUrl } from '../utils/map'
import TileCache from './TileCache'

class TileLayer {
  canvas: OffscreenCanvas
  private readonly tileSize: number
  private readonly cache = new TileCache()

  bbox: BBox = fullBBox
  canvasBBox: BBox = fullBBox
  /**
   * 当前实际显示区域的 BBox，只会比 bbox 更小
   */
  displayBBox: BBox = fullBBox
  z = 0
  onUpdate?: () => void

  constructor (tileSize: number) {
    this.tileSize = tileSize
  }

  /**
   * tileX 有可能小于 0 或者大于等于 z2，需要对其进行格式化
   * @param tileX
   * @returns
   */
  private getFormattedTileX (tileX: number) {
    const z2 = Math.pow(2, this.z)
    return tileX < 0 ? z2 + tileX : tileX % z2
  }

  async loadTile (xyz: XYZ) {
    const promise = fetch(getSatelliteUrl(...xyz)).then(async (res) => {
      const imageBitmap = await createImageBitmap(await res.blob())
      this.cache.set(xyz, imageBitmap)
      return imageBitmap
    })
    this.cache.set(xyz, promise)
    promise.catch(() => {
      this.cache.delete(xyz)
    })

    return await promise
  }

  /**
   * 如果当前缩放层级的 tile 没有加载完毕，则依次寻找更低缩放级别的图片占位
   * @param x
   * @param y
   * @param formattedX
   */
  private drawPreviewImage (x: number, y: number, rect: [number, number, number, number]) {
    const { tileSize, cache, z } = this
    const ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
    const z2 = Math.pow(2, z)
    const formattedX = this.getFormattedTileX(x)
    let cloneX = formattedX
    let cloneY = y
    let cloneZ = z
    while (cloneZ > 0) {
      cloneZ--

      cloneX = Math.floor(cloneX / 2)
      cloneY = Math.floor(cloneY / 2)
      const imageBitmap = cache.get([cloneX, cloneY, cloneZ])
      if (imageBitmap instanceof ImageBitmap) {
        const cloneZ2 = Math.pow(2, cloneZ)
        const ratio = z2 / cloneZ2
        const sw = tileSize / ratio
        const sh = sw
        const sx = (formattedX % ratio) * sw
        const sy = (y % ratio) * sw
        ctx.clearRect(...rect)
        ctx.drawImage(imageBitmap, sx, sy, sw, sh, ...rect)
        continue
      }
    }
  }

  private draw (update?: boolean) {
    const { tileSize, cache, bbox, z, displayBBox } = this
    const ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
    const tileIndexBox = MercatorTile.bboxToTileIndexBox(bbox, z)
    const displayTileIndexBox = MercatorTile.bboxToTileIndexBox(displayBBox, z)
    const drawTileIndexBox = update ? displayTileIndexBox : tileIndexBox

    const xyArr = multiplyArray(range(drawTileIndexBox.startX, drawTileIndexBox.endX), range(drawTileIndexBox.startY, drawTileIndexBox.endY))
    xyArr.forEach(([x, y]) => {
      const formattedX = this.getFormattedTileX(x)
      const xyz: XYZ = [formattedX, y, z]
      let value = cache.get(xyz)
      const rect: [number, number, number, number] = [(x - tileIndexBox.startX) * tileSize, (y - tileIndexBox.startY) * tileSize, tileSize, tileSize]
      const drawImage = (imageBitmap: ImageBitmap) => {
        ctx.clearRect(...rect)
        ctx.drawImage(imageBitmap, ...rect)
      }
      if (value instanceof ImageBitmap) {
        drawImage(value)
        return
      }

      if (isNil(value)) {
        this.drawPreviewImage(x, y, rect)
        const inXRange = inRange(x, displayTileIndexBox.startX, displayTileIndexBox.endX)
        const inYRange = inRange(y, displayTileIndexBox.startY, displayTileIndexBox.endY)
        if (!inXRange || !inYRange) {
          return
        }
        value = this.loadTile(xyz)
      }

      void value.then((imageBitmap) => {
        drawImage(imageBitmap)
        this.onUpdate?.()
      })
    })

    this.onUpdate?.()
  }

  async refresh () {
    const defaultTileXyz: XYZ = [0, 0, 0]
    if (!this.cache.has(defaultTileXyz)) {
      await this.loadTile(defaultTileXyz)
    }

    const { tileSize, bbox, z } = this
    const tileIndexBox = MercatorTile.bboxToTileIndexBox(bbox, z)
    const width = (tileIndexBox.endX - tileIndexBox.startX) * tileSize
    const height = (tileIndexBox.endY - tileIndexBox.startY) * tileSize
    const canvas = new OffscreenCanvas(width, height)
    // 每次刷新时更新 canvas，防止图片异步加载的情况下 ctx.drawImage 错误
    this.canvas = canvas

    this.canvasBBox = [
      MercatorTile.xToLng(tileIndexBox.startX, z),
      MercatorTile.yToLat(tileIndexBox.endY, z),
      MercatorTile.xToLng(tileIndexBox.endX, z),
      MercatorTile.yToLat(tileIndexBox.startY, z),
    ]

    this.draw()
  }

  update () {
    this.draw(true)
  }
}

export default TileLayer
