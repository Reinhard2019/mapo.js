import { TextLayer as _TextLayer } from 'mapo.js'
import { Component, onCleanup, onMount, useContext } from 'solid-js'
import createUpdateEffect from '../hooks/deferCreateEffect'
import { MapContext } from './mapContext'

type TextLayerProps = ConstructorParameters<typeof _TextLayer>[0]

const TextLayer: Component<TextLayerProps> = props => {
  const { map } = useContext(MapContext)
  let textLayer: _TextLayer
  onMount(() => {
    const _map = map?.()
    if (!_map) return

    textLayer = new _TextLayer({
      ...props,
    })
    _map.addLayer(textLayer)
  })

  onCleanup(() => map?.()?.removeLayer(textLayer))

  createUpdateEffect(
    () => props.source,
    () => {
      if (props.source) {
        textLayer.setSource(props.source)
        textLayer.refresh()
      }
    },
  )
  return null
}

export default TextLayer
