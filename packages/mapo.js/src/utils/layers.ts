import { Geometry } from 'geojson'
import { Features } from '../types'
import { toArray } from './array'

export function features2featureArr<G extends Geometry | null = Geometry>(f: Features<G>) {
  return !Array.isArray(f) && f.type === 'FeatureCollection' ? f.features : toArray(f)
}
