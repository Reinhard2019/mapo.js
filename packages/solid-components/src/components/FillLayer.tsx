import { FillLayer as _FillLayer } from 'mapo.js'
import { Component, onCleanup, onMount, useContext } from 'solid-js'
import createUpdateEffect from '../hooks/deferCreateEffect'
import { MapContext } from './mapContext'

type FillLayerProps = ConstructorParameters<typeof _FillLayer>[0]

const FillLayer: Component<FillLayerProps> = props => {
  const { map } = useContext(MapContext)
  let lineLayer: _FillLayer
  onMount(() => {
    const _map = map?.()
    if (!_map) return

    lineLayer = new _FillLayer({
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

export default FillLayer
