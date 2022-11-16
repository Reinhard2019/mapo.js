import { BBox, XYZ } from '../types'

const equirectangularTile = {
  pointToTile (lng: number, lat: number, z: number): XYZ {
    return [
      Math.floor(equirectangularTile.lngToX(lng, z)),
      Math.floor(equirectangularTile.latToY(lat, z)),
      z
    ]
  },

  tileToBBOX (xyz: XYZ): BBox {
    const [x, y, z] = xyz
    const e = equirectangularTile.xToLng(x + 1, z)
    const w = equirectangularTile.xToLng(x, z)
    const s = equirectangularTile.yToLat(y + 1, z)
    const n = equirectangularTile.yToLat(y, z)
    return [w, s, e, n]
  },

  lngToX (lng: number, z: number) {
    return ((lng + 180) / 360) * Math.pow(2, z)
  },

  xToLng (x: number, z: number) {
    return (360 / Math.pow(2, z)) * x - 180
  },

  latToY (lat: number, z: number) {
    return ((90 - lat) / 180) * Math.pow(2, z)
  },

  yToLat (y: number, z: number) {
    return 90 - (180 / Math.pow(2, z)) * y
  }
} as const

export default equirectangularTile
