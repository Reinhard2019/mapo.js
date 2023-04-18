import { LineLayer as _LineLayer } from 'mapo.js'
import { Component, onCleanup, onMount, useContext } from 'solid-js'
import createUpdateEffect from '../hooks/createUpdateEffect'
import { MapContext } from './mapContext'
import createSource from '../hooks/createSource'

type LineLayerProps = ConstructorParameters<typeof _LineLayer>[0] & {
  remoteSourceUrls?: string[]
}

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
  })

  onCleanup(() => {
    map?.()?.removeLayer(lineLayer)
  })

  createUpdateEffect(
    () => props.style,
    () => {
      if (props.style) {
        lineLayer.updateStyle(props.style)
        lineLayer.refresh()
        lineLayer.layerManager?.updateCanvas()
      }
    },
  )

  const source = createSource(props)
  createUpdateEffect(source, input => {
    if (input) {
      lineLayer.setSource(input)
      lineLayer.refresh()
      lineLayer.layerManager?.updateCanvas()
    }
  })

  return null
}

export default LineLayer
