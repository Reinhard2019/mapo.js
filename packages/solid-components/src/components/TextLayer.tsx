import { TextLayer as _TextLayer } from 'mapo.js'
import { Component, onCleanup, onMount, useContext } from 'solid-js'
import createUpdateEffect from '../hooks/createUpdateEffect'
import { MapContext } from './mapContext'
import createSource from '../hooks/createSource'

type TextLayerProps = ConstructorParameters<typeof _TextLayer>[0] & {
  remoteSourceUrls?: string[]
}

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
    () => props.style,
    () => {
      if (props.style) {
        textLayer.updateStyle(props.style)
        textLayer.refresh()
      }
    },
  )

  const source = createSource(props)
  createUpdateEffect(source, () => {
    if (props.source) {
      textLayer.setSource(props.source)
      textLayer.refresh()
    }
  })
  return null
}

export default TextLayer
