import { Position } from 'geojson'
import { BBox } from '../types'

export default function geoEquirectangular (options: {
  bbox: BBox
  size: [number, number]
}) {
  const [w, s, e, n] = options.bbox
  const [width, height] = options.size

  return (position: Position) => {
    const [lng, lat] = position
    const x = ((lng - w) / (e - w) * width)
    const y = ((n - lat) / (n - s) * height)
    return [x, y]
  }
}
