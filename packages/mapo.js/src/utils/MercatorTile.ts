/**
 * 墨卡托投影
 */
import { BBox, TileBox, XYZ } from '../types'
import { degToRad } from './math'
import { clamp, round } from './number'

// https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
const MercatorTile = {
  maxLat: round((Math.atan(Math.sinh(Math.PI)) * 180) / Math.PI, 12),

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

    const [w, s, e, n] = bbox
    const [startX, startY] = MercatorTile.pointToTile(w, n, z)
    const [x2, y2] = MercatorTile.pointToTile(e, s, z)
    const endX = e === MercatorTile.xToLng(x2, z) ? x2 : x2 + 1
    const clampedS = clamp(s, -MercatorTile.maxLat, MercatorTile.maxLat)
    const endY = clampedS === MercatorTile.yToLat(y2, z) ? y2 : y2 + 1
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
    return round((180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), 12)
  },
} as const

export default MercatorTile
