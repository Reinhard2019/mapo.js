import { inRange, isEqual, isNil } from 'lodash-es'
import MercatorTile from '../utils/MercatorTile'
import { BBox, TileBox, XYZ } from '../types'
import { fullBBox } from '../utils/bbox'
import { formatTileXOrY, getSatelliteUrl } from '../utils/map'
import TileCache from '../utils/TileCache'

class TileLayer {
  canvas: OffscreenCanvas = new OffscreenCanvas(1, 1)
  private readonly tileSize: number
  private readonly cache = new TileCache<ImageBitmap | Promise<ImageBitmap>>()

  refreshKey?: number | undefined

  bbox: BBox = fullBBox
  canvasBBox: BBox = fullBBox
  private _z = 0
  private prevZ = 0
  private prevTileBox: TileBox
  onUpdate?: () => void

  constructor(tileSize: number) {
    this.tileSize = tileSize

    void this.loadTile([0, 0, 0])
  }

  get z() {
    return this._z
  }

  set z(value: number) {
    this.prevZ = this._z
    this._z = value
  }

  async loadTile(xyz: XYZ) {
    const promise = fetch(getSatelliteUrl(...xyz)).then(async res => {
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
  private drawPreviewImage(x: number, y: number, rect: [number, number, number, number]) {
    const { tileSize, cache, z, prevZ } = this
    const ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
    const z2 = Math.pow(2, z)
    const formattedX = formatTileXOrY(x, this.z)
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

    // p\
    if (prevZ - z === 1) {
      for (let _x = 0; _x < 2; _x++) {
        for (let _y = 0; _y < 2; _y++) {
          const prevX = x * 2 + _x
          const prevY = y * 2 + _y
          const imageBitmap = cache.get([prevX, prevY, prevZ])
          if (imageBitmap instanceof ImageBitmap) {
            let [dx, dy, dw, dh] = rect
            dw /= 2
            dh /= 2
            dx += _x * dw
            dy += _y * dh
            ctx.clearRect(dx, dy, dw, dh)
            ctx.drawImage(imageBitmap, dx, dy, dw, dh)
          }
        }
      }
    }
  }

  private draw() {
    const { tileSize, cache, bbox, z, refreshKey } = this
    const ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
    const tileBox = MercatorTile.bboxToTileBox(bbox, z)

    // 加载瓦片时优先加载距离中心近的瓦片
    const xyObjArr: Array<{
      x: number
      y: number
      level: number
    }> = []
    const centerX = (tileBox.endX - 1) / 2 + tileBox.startX / 2
    const centerY = (tileBox.endY - 1) / 2 + tileBox.startY / 2
    for (let x = tileBox.startX; x < tileBox.endX; x++) {
      for (let y = tileBox.startY; y < tileBox.endY; y++) {
        const level = Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
        xyObjArr.push({
          x,
          y,
          level,
        })
      }
    }
    xyObjArr
      .sort((a, b) => a.level - b.level)
      .forEach(({ x, y }) => {
        const formattedX = formatTileXOrY(x, this.z)
        const xyz: XYZ = [formattedX, y, z]
        let value = cache.get(xyz)
        const rect: [number, number, number, number] = [
          (x - tileBox.startX) * tileSize,
          (y - tileBox.startY) * tileSize,
          tileSize,
          tileSize,
        ]
        const drawImage = (imageBitmap: ImageBitmap) => {
          ctx.clearRect(...rect)
          ctx.drawImage(imageBitmap, ...rect)
        }
        if (value instanceof ImageBitmap) {
          drawImage(value)
          return
        }

        this.drawPreviewImage(x, y, rect)

        if (isNil(value)) {
          const inXRange = inRange(x, tileBox.startX, tileBox.endX)
          const inYRange = inRange(y, tileBox.startY, tileBox.endY)
          if (!inXRange || !inYRange) {
            return
          }
          value = this.loadTile(xyz)
        }

        void value.then(imageBitmap => {
          // 防止异步导致的渲染混乱
          if (refreshKey === this.refreshKey) {
            drawImage(imageBitmap)
            this.onUpdate?.()
          }
        })
      })

    this.onUpdate?.()
  }

  refresh() {
    const { tileSize, prevTileBox, bbox, z } = this
    const tileBox = MercatorTile.bboxToTileBox(bbox, z)

    if (isEqual(tileBox, prevTileBox)) return
    this.prevTileBox = tileBox

    this.canvas.width = (tileBox.endX - tileBox.startX) * tileSize
    this.canvas.height = (tileBox.endY - tileBox.startY) * tileSize
    this.refreshKey = new Date().valueOf()

    this.canvasBBox = MercatorTile.tileBoxToBBox(tileBox, z)

    this.draw()
  }
}

export default TileLayer
