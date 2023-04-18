import { Features } from 'mapo.js/esm/types'
import createRemoteSources from './createRemoteSources'
import { featureCollection } from '@turf/turf'
import { getFeatures } from '../utils'

export default function createSource(props: { source: Features; remoteSourceUrls?: string[] }) {
  const remoteSources = createRemoteSources(() => props.remoteSourceUrls)
  return () => {
    const sources = [props.source, ...remoteSources()]
    return featureCollection(sources.flatMap(getFeatures))
  }
}
