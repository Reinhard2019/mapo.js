import { inRange, isNil } from 'lodash-es'
import MercatorTile from '../utils/MercatorTile'
import { BBox, XYZ } from '../types'
import { fullBBox } from '../utils/bbox'
import { formatTileX, getSatelliteUrl } from '../utils/map'
import TileCache from '../utils/TileCache'

class TileLayer {
  canvas: OffscreenCanvas = new OffscreenCanvas(1, 1)
  private readonly tileSize: number
  private readonly cache = new TileCache<ImageBitmap | Promise<ImageBitmap>>()

  refreshKey?: number | undefined

  bbox: BBox = fullBBox
  canvasBBox: BBox = fullBBox
  /**
   * 当前实际显示区域的 BBox，只会比 bbox 更小
   */
  displayBBox: BBox = fullBBox
  z = 0
  onUpdate?: () => void

  constructor(tileSize: number) {
    this.tileSize = tileSize

    void this.loadTile([0, 0, 0])
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
    const { tileSize, cache, z } = this
    const ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
    const z2 = Math.pow(2, z)
    const formattedX = formatTileX(x, this.z)
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

  private draw(update?: boolean) {
    const { tileSize, cache, bbox, z, displayBBox, refreshKey } = this
    const ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
    const tileIndexBox = MercatorTile.bboxToTileIndexBox(bbox, z)
    const displayTileIndexBox = MercatorTile.bboxToTileIndexBox(displayBBox, z)
    const drawTileIndexBox = update ? displayTileIndexBox : tileIndexBox

    // 加载瓦片时优先加载距离中心近的瓦片
    const xyObjArr: Array<{
      x: number
      y: number
      level: number
    }> = []
    const centerX = (drawTileIndexBox.endX - 1) / 2 + drawTileIndexBox.startX / 2
    const centerY = (drawTileIndexBox.endY - 1) / 2 + drawTileIndexBox.startY / 2
    for (let x = drawTileIndexBox.startX; x < drawTileIndexBox.endX; x++) {
      for (let y = drawTileIndexBox.startY; y < drawTileIndexBox.endY; y++) {
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
        const formattedX = formatTileX(x, this.z)
        const xyz: XYZ = [formattedX, y, z]
        let value = cache.get(xyz)
        const rect: [number, number, number, number] = [
          (x - tileIndexBox.startX) * tileSize,
          (y - tileIndexBox.startY) * tileSize,
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
          const inXRange = inRange(x, displayTileIndexBox.startX, displayTileIndexBox.endX)
          const inYRange = inRange(y, displayTileIndexBox.startY, displayTileIndexBox.endY)
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
    const { tileSize, bbox, z } = this
    const tileIndexBox = MercatorTile.bboxToTileIndexBox(bbox, z)
    this.canvas.width = (tileIndexBox.endX - tileIndexBox.startX) * tileSize
    this.canvas.height = (tileIndexBox.endY - tileIndexBox.startY) * tileSize
    this.refreshKey = new Date().valueOf()

    this.canvasBBox = [
      MercatorTile.xToLng(tileIndexBox.startX, z),
      MercatorTile.yToLat(tileIndexBox.endY, z),
      MercatorTile.xToLng(tileIndexBox.endX, z),
      MercatorTile.yToLat(tileIndexBox.startY, z),
    ]

    this.draw()
  }

  update() {
    this.draw(true)
  }
}

export default TileLayer
