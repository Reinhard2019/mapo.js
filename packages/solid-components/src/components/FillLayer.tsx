import { FillLayer as _FillLayer } from 'mapo.js'
import { Component, onCleanup, onMount, useContext } from 'solid-js'
import createUpdateEffect from '../hooks/deferCreateEffect'
import { MapContext } from './mapContext'

type FillLayerProps = ConstructorParameters<typeof _FillLayer>[0]

const FillLayer: Component<FillLayerProps> = props => {
  const { map } = useContext(MapContext)
  let fillLayer: _FillLayer
  onMount(() => {
    const _map = map?.()
    if (!_map) return

    fillLayer = new _FillLayer({
      ...props,
    })
    _map.addLayer(fillLayer)
  })

  onCleanup(() => map?.()?.removeLayer(fillLayer))

  createUpdateEffect(
    () => props.source,
    () => {
      if (props.source) {
        fillLayer.setSource(props.source)
        fillLayer.refresh()
        fillLayer.layerManager?.updateCanvas()
      }
    },
  )
  return null
}

export default FillLayer
