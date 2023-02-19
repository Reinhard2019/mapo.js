/**
 * 等距长方投影
 * !!! 会用于 Web Worker
 */
import { BBox, TileIndexBox, XYZ } from '../types'

class EquirectangularTile {
  static pointToTile (lng: number, lat: number, z: number): [number, number] {
    return [
      Math.floor(EquirectangularTile.lngToX(lng, z)),
      Math.floor(EquirectangularTile.latToY(lat, z)),
    ]
  }

  static tileToBBox (xyz: XYZ): BBox {
    const [x, y, z] = xyz
    const e = EquirectangularTile.xToLng(x + 1, z)
    const w = EquirectangularTile.xToLng(x, z)
    const s = EquirectangularTile.yToLat(y + 1, z)
    const n = EquirectangularTile.yToLat(y, z)
    return [w, s, e, n]
  }

  /**
   * 将边界 box 转化为 tile 索引的 box
   */
  static bboxToTileIndexBox (bbox: BBox, z: number): TileIndexBox {
    const [w, s, e, n] = bbox
    const [startX, startY] = EquirectangularTile.pointToTile(w, n, z)
    const [x2, y2] = EquirectangularTile.pointToTile(e, s, z)
    const endX = e === EquirectangularTile.xToLng(x2, z) ? x2 : x2 + 1
    const endY = s === EquirectangularTile.yToLat(y2, z) ? y2 : y2 + 1
    return {
      startX,
      startY,
      endX,
      endY
    }
  }

  static lngToX (lng: number, z: number) {
    return ((lng + 180) / 360) * Math.pow(2, z)
  }

  static xToLng (x: number, z: number) {
    return (360 / Math.pow(2, z)) * x - 180
  }

  static latToY (lat: number, z: number) {
    return ((90 - lat) / 180) * Math.pow(2, z)
  }

  static yToLat (y: number, z: number) {
    return 90 - (180 / Math.pow(2, z)) * y
  }
}

export default EquirectangularTile
