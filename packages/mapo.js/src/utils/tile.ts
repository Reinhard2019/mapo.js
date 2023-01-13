import EquirectangularTile from '../tiles/EquirectangularTile'
import MercatorTile from '../tiles/MercatorTile'

export function mercatorY2equirectangularY (y: number, z: number) {
  const lat = MercatorTile.yToLat(y, z)
  return EquirectangularTile.latToY(lat, z)
}

export function equirectangularY2mercatorY (y: number, z: number) {
  const lat = EquirectangularTile.yToLat(y, z)
  return MercatorTile.latToY(lat, z)
}
