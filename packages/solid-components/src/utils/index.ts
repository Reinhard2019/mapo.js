import { Geometry } from 'geojson'
import { Features } from 'mapo.js/esm/types'

export function getFeatures<G extends Geometry = Geometry>(f: Features<G> | undefined) {
  if (!f) return []

  if (Array.isArray(f)) {
    return f
  } else if (f.type === 'FeatureCollection') {
    return f.features
  }

  return [f]
}
