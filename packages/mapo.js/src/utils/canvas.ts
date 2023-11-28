import { XYZ } from '../types'
import { formatXYZ } from './map'
import TileCache from './TileCache'

/**
 * 如果当前缩放层级的 tile 没有加载完毕，则依次寻找更低缩放级别的图片占位
 * @param options
 */
export function drawPreviewImage(options: {
  ctx: OffscreenCanvasRenderingContext2D
  xyz: XYZ
  tileSize: number
  tileCache: TileCache<CanvasImageSource | Promise<CanvasImageSource>>
  dx?: number
  dy?: number
}) {
  const { ctx, xyz, tileSize, tileCache, dx = 0, dy = 0 } = options
  const [x, y, z] = formatXYZ(xyz)
  const z2 = Math.pow(2, z)
  let cloneX = x
  let cloneY = y
  let cloneZ = z
  while (cloneZ > 0) {
    cloneZ--

    cloneX = Math.floor(cloneX / 2)
    cloneY = Math.floor(cloneY / 2)
    const canvasImageSource = tileCache.get([cloneX, cloneY, cloneZ])
    if (canvasImageSource && !(canvasImageSource instanceof Promise)) {
      const cloneZ2 = Math.pow(2, cloneZ)
      const ratio = z2 / cloneZ2
      const sw = tileSize / ratio
      const sh = sw
      const sx = (x % ratio) * sw
      const sy = (y % ratio) * sw
      const rect = [dx, dy, tileSize, tileSize] as const
      ctx.clearRect(...rect)
      ctx.drawImage(canvasImageSource, sx, sy, sw, sh, ...rect)
      break
    }
  }

  // 如果存在更高 1 个层级的 tile，同样可以作为占位图
  // 通常适用于从高层级逐层缩小，只存在高层级，但不存在低层级的情况，缩小一个层级后会出现突然没有 tile 的情况
  // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
  const prevZ = z + 1
  for (let _x = 0; _x < 2; _x++) {
    for (let _y = 0; _y < 2; _y++) {
      const prevX = x * 2 + _x
      const prevY = y * 2 + _y
      const canvasImageSource = tileCache.get([prevX, prevY, prevZ])
      if (canvasImageSource && !(canvasImageSource instanceof Promise)) {
        const dw = tileSize / 2
        const dh = tileSize / 2
        const _dx = dx + _x * dw
        const _dy = dy + _y * dh
        const rect = [_dx, _dy, dw, dh] as const
        ctx.clearRect(...rect)
        ctx.drawImage(canvasImageSource, ...rect)
      }
    }
  }
}
