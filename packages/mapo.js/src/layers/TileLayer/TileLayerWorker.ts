import { uniq } from 'lodash-es'
import EquirectangularTile from '../../tiles/EquirectangularTile'
import MercatorTile from '../../tiles/MercatorTile'
import { BBox, XYZ } from '../../types'
import { range } from '../../utils'
import { keyBy, last } from '../../utils/array'
import { degToRad } from '../../utils/math'
import { mercatorY2equirectangularY } from '../../utils/tile'
import TileLoader from './TileLoader'

function getTileXYList (tileYObjList: Array<{
  y: number
  tileXList: number[]
}>) {
  if (!tileYObjList.length) {
    return []
  }

  const tileXYList: number[][] = []

  const tileXListLen = tileYObjList[0].tileXList.length
  // 按照是否靠近中间排序
  const halfXLen = tileXListLen / 2
  let startXIndex = Number.isInteger(halfXLen) ? halfXLen - 1 : Math.floor(halfXLen)
  let endXIndex = Number.isInteger(halfXLen) ? halfXLen : Math.floor(halfXLen)
  const halfYLen = tileYObjList.length / 2
  let startYIndex = Number.isInteger(halfYLen) ? halfYLen - 1 : Math.floor(halfYLen)
  let endYIndex = Number.isInteger(halfYLen) ? halfYLen : Math.floor(halfYLen)
  while (true) {
    const xIndexList = range(startXIndex, endXIndex + 1)
    const yIndexList = startYIndex === endYIndex ? [] : range(startYIndex + 1, endYIndex)
    tileXYList.push(
      ...xIndexList.map(xIndex => {
        const tileY = tileYObjList[startYIndex]
        return [tileY.tileXList[xIndex], tileY.y]
      }),
      ...yIndexList.flatMap(yIndex => {
        const tileY = tileYObjList[yIndex]
        return [[tileY.tileXList[startXIndex], tileY.y], [tileY.tileXList[endXIndex], tileY.y]]
      }),
      ...startYIndex === endYIndex
        ? []
        : xIndexList.map(xIndex => {
          const tileY = tileYObjList[endYIndex]
          return [tileY.tileXList[xIndex], tileY.y]
        }),
    )

    if (startXIndex === 0 && endXIndex === tileXListLen - 1 && startYIndex === 0 && endYIndex === tileYObjList.length - 1) {
      break
    }

    startXIndex = Math.max(startXIndex - 1, 0)
    endXIndex = Math.min(endXIndex + 1, tileXListLen - 1)

    startYIndex = Math.max(startYIndex - 1, 0)
    endYIndex = Math.min(endYIndex + 1, tileYObjList.length - 1)
  }

  return tileXYList
}

interface BaseMessageEventData {
  tileSize: number
}
interface UpdateMessageEventData extends BaseMessageEventData {
  type: 'update'
  canvas: OffscreenCanvas
  bbox: BBox
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
  const { canvas, bbox, z, tileSize } = event.data
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D

  const [w, s, e, n] = bbox
  const z2 = Math.pow(2, z)
  const startPixelX = Math.round(EquirectangularTile.lngToX(w, z) * tileSize)
  const startPixelY = Math.round(EquirectangularTile.latToY(n, z) * tileSize)
  /**
   * 起始纬度 90 在 canvas 中的 y 值
   */
  const startLatCanvasY = -startPixelY
  /**
   * 结束纬度 -90 在 canvas 中的 y 值
   */
  const endLatCanvasY = z2 * tileSize - startPixelY

  canvas.width = (e - w) / 360 * z2 * tileSize
  canvas.height = (n - s) / 180 * z2 * tileSize
  console.log('canvas', canvas.width, canvas.height, n, s, bbox)

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
    console.log(tileIndexBox, _bbox, z)

    const tileXList = range(tileIndexBox.startX, tileIndexBox.endX)
    const tileYList = range(tileIndexBox.startY, tileIndexBox.endY)
    const equirectangularPixelXList = [...tileXList, tileIndexBox.endX].map(x => (reverse ? x - z2 / 2 : x) * tileSize - startPixelX)
    const equirectangularPixelYList = [...tileYList, tileIndexBox.endY].map(y => {
      return Math.round(mercatorY2equirectangularY(y, z) * tileSize) - startPixelY
    })

    function drawImage (imageBitmap: ImageBitmap, tileX: number, tileY: number)
    function drawImage (imageBitmap: ImageBitmap, tileX: number, tileY: number, sx: number, sy: number, sw: number, sh: number)
    function drawImage (imageBitmap: ImageBitmap, tileX: number, tileY: number, sx?: number, sy?: number, sw?: number, sh?: number) {
      const _dx = equirectangularPixelXList[tileX - tileIndexBox.startX]
      const nextDx = equirectangularPixelXList[tileX - tileIndexBox.startX + 1]
      const _dy = equirectangularPixelYList[tileY - tileIndexBox.startY]
      const nextDy = equirectangularPixelYList[tileY - tileIndexBox.startY + 1]
      const dw = nextDx - _dx
      const dh = nextDy - _dy
      let translateX = 0
      let translateY = 0
      if (reverse) {
        ctx.save()
        translateX = (last(equirectangularPixelXList) - equirectangularPixelXList[0]) / 2
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
      tileYObjList,
      draw: (x: number, y: number) => {
        const formattedX = x < 0 ? z2 + x : x % z2

        const value = cache.tileLoader.loadTile([formattedX, y, z], tileSize)
        if (value instanceof ImageBitmap) {
          drawImage(value, x, y)
        } else {
          drawPreviewImage(x, y, formattedX)
          void value.then((imageBitmap) => {
            // 防止短时间内多次调用 update 函数，由于异步加载导致渲染错误
            if (updateId === cache.updateId) {
              drawImage(imageBitmap, x, y)
              updateImageBitmap()
            }
          })
        }
      }
    }
  }
  const render = (arr: Array<ReturnType<typeof getDrawObj>>) => {
    const tileYDictList = arr.map(value => keyBy(value.tileYObjList, v => v.y))
    getTileXYList(arr.flatMap(v => v.tileYObjList)).forEach(([x, y]) => {
      for (let i = 0; i < tileYDictList.length; i++) {
        if (tileYDictList[i][y]) {
          arr[i].draw(x, y)
        }
      }
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
  getTileXYList,
  update,
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
