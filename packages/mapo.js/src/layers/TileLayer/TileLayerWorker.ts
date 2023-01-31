import { uniq } from 'lodash-es'
import EquirectangularTile from '../../tiles/EquirectangularTile'
import MercatorTile from '../../tiles/MercatorTile'
import { BBox, XYZ } from '../../types'
import { isNil, range } from '../../utils'
import { keyBy, last, multiplyArray } from '../../utils/array'
import { degToRad } from '../../utils/math'
import { inRange } from '../../utils/number'
import { mercatorY2equirectangularY } from '../../utils/tile'
import TileLoader from './TileLoader'

interface BaseMessageEventData {
  tileSize: number
}
interface UpdateMessageEventData extends BaseMessageEventData {
  type: 'update'
  canvas: OffscreenCanvas
  bbox: BBox
  displayBBox: BBox
  z: number
}
interface LoadTileMessageEventData extends BaseMessageEventData {
  type: 'loadTile'
  xyz: XYZ
}
type MessageEventData = UpdateMessageEventData | LoadTileMessageEventData

function isUpdateType (e: MessageEvent<MessageEventData>): e is MessageEvent<UpdateMessageEventData> {
  return e.data.type === 'update'
}
function isLoadTileType (e: MessageEvent<MessageEventData>): e is MessageEvent<LoadTileMessageEventData> {
  return e.data.type === 'loadTile'
}

function getCache () {
  const extendSelf = self as unknown as {
    tileLoader: TileLoader
    updateId?: Symbol
  }
  if (!extendSelf.tileLoader) {
    extendSelf.tileLoader = new TileLoader()
  }
  return extendSelf
}

function update (event: MessageEvent<UpdateMessageEventData>) {
  const cache = getCache()
  const updateId = cache.updateId = Symbol('')
  const { canvas, bbox, displayBBox, z, tileSize } = event.data
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D

  const z2 = Math.pow(2, z)
  // tileX 有可能小于 0 或者大于等于 z2，需要对其进行格式化
  const getFormattedTileX = (tileX: number) => tileX < 0 ? z2 + tileX : tileX % z2
  const displayTileIndexLevelDict = (function () {
    const [w, s, e, n] = displayBBox
    let bboxList: BBox[] = [displayBBox]
    // 如果纬度大于 90 或者小于 -90，把 bbox 拆分为两个来 render
    if (n > 90) {
      bboxList = [
        [w + 180, 180 - n, e + 180, 90],
        [w, s, e, 90],
      ]
    } else if (s < -90) {
      bboxList = [
        [w, -90, e, n],
        [w + 180, -90, e + 180, 90 + s]
      ]
    }
    return bboxList.flatMap(_bbox => {
      const tileIndexBox = MercatorTile.bboxToTileIndexBox(_bbox, z)
      const xList = range(tileIndexBox.startX, tileIndexBox.endX).map(x => getFormattedTileX(x))
      const yList = range(tileIndexBox.startY, tileIndexBox.endY)
      return yList.map(y => ({
        y,
        xList,
      }))
    }).reduce<Record<string, number>>((result, yObj, yIndex, arr) => {
      const yListLen = arr.length
      yObj.xList.forEach((x, xIndex) => {
        const xListLen = yObj.xList.length

        let xLevel = 0
        const halfXLen = xListLen / 2
        if (Number.isInteger(halfXLen)) {
          xLevel = xIndex > halfXLen ? xIndex - halfXLen : halfXLen - 1 - xIndex
        } else {
          xLevel = Math.abs(xIndex - Math.floor(halfXLen))
        }

        let yLevel = 0
        const halfYLen = yListLen / 2
        if (Number.isInteger(halfYLen)) {
          yLevel = yIndex > halfYLen ? yIndex - halfYLen : halfYLen - 1 - yIndex
        } else {
          yLevel = Math.abs(yIndex - Math.floor(halfYLen))
        }

        /**
         * 加载优先级，越靠近中心优先级越高，level 数字越小
         */
        const level = Math.max(xLevel, yLevel)
        const xy = [x, yObj.y]
        const key = xy.toString()
        result[key] = level
      })
      return result
    }, {})
  })()
  const [w, s, e, n] = bbox
  const startEquirectangularPixelX = Math.round(EquirectangularTile.lngToX(w, z) * tileSize)
  const startEquirectangularPixelY = Math.round(EquirectangularTile.latToY(n, z) * tileSize)
  /**
   * 起始纬度 90 在 canvas 中的 y 值
   */
  const startLatCanvasY = -startEquirectangularPixelY
  /**
   * 结束纬度 -90 在 canvas 中的 y 值
   */
  const endLatCanvasY = z2 * tileSize - startEquirectangularPixelY

  canvas.width = (e - w) / 360 * z2 * tileSize
  canvas.height = (n - s) / 180 * z2 * tileSize

  const updateImageBitmap = () => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    void createImageBitmap(imageData).then(imageBitmap => {
      postMessage({
        type: 'update',
        imageBitmap,
      })
    })
  }
  const getDrawObj = (_bbox: BBox, reverse?: boolean, gt90?: boolean) => {
    const tileIndexBox = MercatorTile.bboxToTileIndexBox(_bbox, z)

    const tileXList = range(tileIndexBox.startX, tileIndexBox.endX)
    const tileYList = range(tileIndexBox.startY, tileIndexBox.endY)
    const getTileCanvasX = (tileX) => (reverse ? tileX - z2 / 2 : tileX) * tileSize - startEquirectangularPixelX
    const getTileCanvasY = (tileY) => Math.round(mercatorY2equirectangularY(tileY, z) * tileSize) - startEquirectangularPixelY
    const reverseTranslateX = (getTileCanvasX(tileIndexBox.startX) + getTileCanvasX(tileIndexBox.endX)) / 2

    function drawImage (imageBitmap: ImageBitmap, tileX: number, tileY: number)
    function drawImage (imageBitmap: ImageBitmap, tileX: number, tileY: number, sx: number, sy: number, sw: number, sh: number)
    function drawImage (imageBitmap: ImageBitmap, tileX: number, tileY: number, sx?: number, sy?: number, sw?: number, sh?: number) {
      const _dx = getTileCanvasX(tileX)
      const nextDx = getTileCanvasX(tileX + 1)
      const _dy = getTileCanvasY(tileY)
      const nextDy = getTileCanvasY(tileY + 1)
      const dw = nextDx - _dx
      const dh = nextDy - _dy
      let translateX = 0
      let translateY = 0
      if (reverse) {
        ctx.save()
        translateX = reverseTranslateX
        translateY = gt90 ? startLatCanvasY : endLatCanvasY
        ctx.translate(translateX, translateY)
        ctx.rotate(degToRad(180))
      }
      const dx = _dx - translateX
      const dy = _dy - translateY
      ctx.clearRect(dx, dy, dw, dh)
      if (typeof sw === 'number') {
        ctx.drawImage(imageBitmap, sx, sy, sw, sh, dx, dy, dw, dh)
      } else {
        ctx.drawImage(imageBitmap, dx, dy, dw, dh)
      }
      if (tileY === 0) {
        const dy2 = startLatCanvasY - translateY
        const dh2 = dy - dy2
        ctx.clearRect(dx, dy2, dw, dh2)
        if (dh2 > 0) {
          ctx.drawImage(imageBitmap, sx ?? 0, 0, sw ?? imageBitmap.width, 1, dx, dy2, dw, dh2)
        }
      }
      if (tileY === z2 - 1) {
        const dy2 = dy + dh
        const dh2 = endLatCanvasY - dy2 - translateY
        ctx.clearRect(dx, dy2, dw, dh2)
        if (dh2 > 0) {
          ctx.drawImage(imageBitmap, sx ?? 0, imageBitmap.height - 1, sw ?? imageBitmap.width, 1, dx, dy2, dw, dh2)
        }
      }
      ctx.restore()
    }

    // 如果当前缩放层级的 tile 没有加载完毕，则依次寻找更低缩放级别的图片占位
    const drawPreviewImage = (x: number, y: number, formattedX: number) => {
      let cloneX = formattedX
      let cloneY = y
      let cloneZ = z
      let loop = true
      while (loop && cloneZ > 0) {
        cloneZ--

        cloneX = Math.floor(cloneX / 2)
        cloneY = Math.floor(cloneY / 2)
        const item = cache.tileLoader.getCacheTile([cloneX, cloneY, cloneZ])
        if (item instanceof ImageBitmap) {
          const cloneZ2 = Math.pow(2, cloneZ)
          const sx = formattedX / z2 * cloneZ2 * tileSize - cloneX * tileSize
          const sw = tileSize / (z2 / cloneZ2)
          const startTilePixelY = Math.round(mercatorY2equirectangularY(cloneY, cloneZ) * tileSize)
          const lat = MercatorTile.yToLat(y, z)
          const sy = Math.round(EquirectangularTile.latToY(lat, cloneZ) * tileSize) - startTilePixelY
          const nextLat = MercatorTile.yToLat(y + 1, z)
          const nextSy = Math.round(EquirectangularTile.latToY(nextLat, cloneZ) * tileSize) - startTilePixelY
          const sh = nextSy - sy
          drawImage(item, x, y, sx, sy, sw, sh)
          loop = false
        }
      }
    }

    const tileYObjList = tileYList.map(y => ({
      y,
      tileXList,
    }))
    if (reverse) {
      tileYObjList.reverse()
    }
    return {
      xyList: multiplyArray(tileXList, tileYList, true),
      tileYObjList,
      draw: (x: number, y: number) => {
        const formattedX = x < 0 ? z2 + x : x % z2

        let tile = cache.tileLoader.getCacheTile([formattedX, y, z])
        if (tile instanceof ImageBitmap) {
          drawImage(tile, x, y)
          return
        }

        drawPreviewImage(x, y, formattedX)

        if (isNil(tile)) {
          const key = [formattedX, y].toString()
          if (isNil(displayTileIndexLevelDict[key])) {
            return
          }
          tile = cache.tileLoader.loadTile([formattedX, y, z], tileSize)
        }

        void tile.then((imageBitmap) => {
          // 防止短时间内多次调用 update 函数，由于异步加载导致渲染错误
          if (updateId === cache.updateId) {
            drawImage(imageBitmap, x, y)
            updateImageBitmap()
          }
        })
      }
    }
  }
  const render = (arr: Array<ReturnType<typeof getDrawObj>>) => {
    arr.flatMap(v => v.xyList.map(xy => ({
      xy,
      draw: v.draw
    }))).sort((v1, v2) => {
      // 根据加载优先级来排序
      const key1 = v1.xy.toString()
      const level1 = displayTileIndexLevelDict[key1]

      const key2 = v2.xy.toString()
      const level2 = displayTileIndexLevelDict[key2]
      if (isNil(level2)) {
        return -1
      }
      if (isNil(level1)) {
        return 1
      }
      return level1 - level2
    }).forEach(({ xy, draw }) => {
      draw(...xy)
    })
  }

  // 如果纬度大于 90 或者小于 -90，把 bbox 拆分为两个来 render
  if (n > 90) {
    render([
      getDrawObj([w + 180, 180 - n, e + 180, 90], true, true),
      getDrawObj([w, s, e, 90]),
    ])
  } else if (s < -90) {
    render([
      getDrawObj([w, -90, e, n]),
      getDrawObj([w + 180, -90, e + 180, 90 + s], true)
    ])
  } else {
    render([
      getDrawObj(bbox)
    ])
  }

  updateImageBitmap()
}

function onmessage (event: MessageEvent<MessageEventData>) {
  if (isUpdateType(event)) {
    update(event)
  } else if (isLoadTileType(event)) {
    void getCache().tileLoader.loadTile(event.data.xyz, event.data.tileSize).then(imageBitmap => {
      postMessage({
        type: 'loadTile',
        error: false,
        imageBitmap,
      })
    }).catch(() => {
      postMessage({
        type: 'loadTile',
        error: true,
      })
    })
  }
}

const scripts = uniq([
  getCache,
  isUpdateType,
  isLoadTileType,
  range,
  keyBy,
  last,
  degToRad,
  mercatorY2equirectangularY,
  EquirectangularTile,
  ...MercatorTile.workerScripts,
  ...TileLoader.workerScripts,
  update,
  inRange,
  multiplyArray,
  isNil,
])
const blob = new Blob([
  ...scripts.map(v => v.toString()).join('\n\n'),
  '\n\n',
  `onmessage = ${onmessage.toString()}`,
])

const workerUrl = URL.createObjectURL(blob)

// TODO 在 solid-start 服务器中，本文件会运行在 node 环境中，node 中没有 Worker，为避免报错，模拟 Worker
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
const Worker = globalThis.Worker ?? (class {} as any as typeof globalThis.Worker)
class TileLayerWorker extends Worker {
  constructor () {
    super(workerUrl)
  }

  postMessage (message: MessageEventData, ...argus) {
    super.postMessage(message, ...argus)
  }

  async loadTile (xyz: XYZ, tileSize: number) {
    return await new Promise<ImageBitmap>((resolve, reject) => {
      this.postMessage({
        type: 'loadTile',
        xyz,
        tileSize,
      })
      const onMessage = (e) => {
        if (e.data.type === 'loadTile') {
          const { error, imageBitmap } = e.data
          if (error) {
            reject(new Error())
          } else {
            resolve(imageBitmap)
          }
          this.removeEventListener('message', onMessage)
        }
      }
      this.addEventListener('message', onMessage)
    })
  }
}

export default TileLayerWorker
