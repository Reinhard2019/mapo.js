import { PointLayer as _PointLayer } from 'mapo.js'
import { Component, onCleanup, onMount, useContext } from 'solid-js'
import createUpdateEffect from '../hooks/createUpdateEffect'
import { MapContext } from './mapContext'
import createSource from '../hooks/createSource'

type PointLayerProps = ConstructorParameters<typeof _PointLayer>[0] & {
  remoteSourceUrls?: string[]
}

const PointLayer: Component<PointLayerProps> = props => {
  const { map } = useContext(MapContext)
  let pointLayer: _PointLayer
  onMount(() => {
    const _map = map?.()
    if (!_map) return

    pointLayer = new _PointLayer({
      ...props,
    })
    _map.addLayer(pointLayer)
  })

  onCleanup(() => map?.()?.removeLayer(pointLayer))

  createUpdateEffect(
    () => props.style,
    () => {
      if (props.style) {
        pointLayer.updateStyle(props.style)
        pointLayer.refresh()
      }
    },
  )

  const source = createSource(props)
  createUpdateEffect(source, () => {
    if (props.source) {
      pointLayer.setSource(props.source)
      pointLayer.refresh()
    }
  })
  return null
}

export default PointLayer
