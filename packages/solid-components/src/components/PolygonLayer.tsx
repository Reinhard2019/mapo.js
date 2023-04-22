import { PolygonLayer as _PolygonLayer } from 'mapo.js'
import { Component, onCleanup, onMount, useContext } from 'solid-js'
import createUpdateEffect from '../hooks/createUpdateEffect'
import { MapContext } from './mapContext'
import createSource from '../hooks/createSource'

type PolygonLayerProps = ConstructorParameters<typeof _PolygonLayer>[0] & {
  remoteSourceUrls?: string[]
}

const PolygonLayer: Component<PolygonLayerProps> = props => {
  const { map } = useContext(MapContext)
  let polygonLayer: _PolygonLayer
  onMount(() => {
    const _map = map?.()
    if (!_map) return

    polygonLayer = new _PolygonLayer({
      ...props,
    })
    _map.addLayer(polygonLayer)
  })

  onCleanup(() => map?.()?.removeLayer(polygonLayer))

  createUpdateEffect(
    () => props.style,
    () => {
      if (props.style) {
        polygonLayer.updateStyle(props.style)
        polygonLayer.refresh()
        polygonLayer.layerManager?.updateCanvas()
      }
    },
  )

  const source = createSource(props)
  createUpdateEffect(source, () => {
    if (props.source) {
      polygonLayer.setSource(props.source)
      polygonLayer.refresh()
      polygonLayer.layerManager?.updateCanvas()
    }
  })
  return null
}

export default PolygonLayer
