import { LineLayer as _LineLayer } from 'mapo.js'
import { Component, onCleanup, onMount, useContext } from 'solid-js'
import createUpdateEffect from '../hooks/deferCreateEffect'
import { MapContext } from './mapContext'

type LineLayerProps = ConstructorParameters<typeof _LineLayer>[0]

const LineLayer: Component<LineLayerProps> = props => {
  const { map } = useContext(MapContext)
  let lineLayer: _LineLayer
  onMount(() => {
    const _map = map?.()
    if (!_map) return

    lineLayer = new _LineLayer({
      ...props,
    })
    _map.addLayer(lineLayer)
    onCleanup(() => _map.removeLayer(lineLayer))
  })

  createUpdateEffect(
    () => props.source,
    () => {
      if (props.source) {
        lineLayer.setSource(props.source)
        lineLayer.refresh()
      }
    },
  )
  return null
}

export default LineLayer
