/**
 * 墨卡托投影
 */
import { BBox, TileBox, XYZ } from '../types'
import { degToRad } from './math'
import { clamp, round } from './number'

// https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
const MercatorTile = {
  maxLat: (Math.atan(Math.sinh(Math.PI)) * 180) / Math.PI,

  pointToTile(lng: number, lat: number, z: number): [number, number] {
    return [Math.floor(MercatorTile.lngToX(lng, z)), Math.floor(MercatorTile.latToY(lat, z))]
  },

  tileToBBox(xyz: XYZ): BBox {
    const [x, y, z] = xyz
    const e = MercatorTile.xToLng(x + 1, z)
    const w = MercatorTile.xToLng(x, z)
    const s = MercatorTile.yToLat(y + 1, z)
    const n = MercatorTile.yToLat(y, z)
    return [w, s, e, n]
  },

  /**
   * 将边界 box 转化为 tile 索引的 box
   */
  bboxToTileBox(bbox: BBox, z: number): TileBox {
    if (z === 0) {
      return {
        startX: 0,
        endX: 1,
        startY: 0,
        endY: 1,
      }
    }

    const isLatEqual = (a: number, b: number) => round(a, 12) === round(b, 12)

    const [w, s, e, n] = bbox
    const [startX, startY] = MercatorTile.pointToTile(w, n, z)
    let [endX, endY] = MercatorTile.pointToTile(e, s, z)
    endX = e === MercatorTile.xToLng(endX, z) ? endX : endX + 1
    const clampedS = clamp(s, -MercatorTile.maxLat, MercatorTile.maxLat)
    endY = isLatEqual(clampedS, MercatorTile.yToLat(endY, z)) ? endY : endY + 1
    return {
      startX,
      startY,
      endX,
      endY,
    }
  },

  tileBoxToBBox(tileBox: TileBox, z: number): BBox {
    return [
      MercatorTile.xToLng(tileBox.startX, z),
      MercatorTile.yToLat(tileBox.endY, z),
      MercatorTile.xToLng(tileBox.endX, z),
      MercatorTile.yToLat(tileBox.startY, z),
    ]
  },

  lngToX(lng: number, z: number) {
    return ((lng + 180) / 360) * Math.pow(2, z)
  },

  xToLng(x: number, z: number) {
    return (360 / Math.pow(2, z)) * x - 180
  },

  latToY(lat: number, z: number) {
    const sin = Math.sin(degToRad(lat))
    const z2 = Math.pow(2, z)
    const y = z2 * (0.5 - (0.25 * Math.log((1 + sin) / (1 - sin))) / Math.PI)
    return clamp(y, 0, z2)
  },

  yToLat(y: number, z: number) {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z)
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
  },
} as const

export default MercatorTile
