import { Component, onCleanup, onMount, splitProps, JSXElement, createSignal } from 'solid-js'
import { Map as _Map } from 'mapo.js'
import { MapOptions } from 'mapo.js/esm/types'
import { MapContext } from './mapContext'
import createUpdateEffect from '../hooks/deferCreateEffect'

interface MapProps extends Omit<MapOptions, 'container'> {
  class?: string
  children?: JSXElement
}

const Map: Component<MapProps> = props => {
  const [_, mapOptions] = splitProps(props, ['class', 'children'])

  let mapRef: HTMLDivElement
  const [map, setMap] = createSignal<_Map>()
  onMount(() => {
    const _map = new _Map({
      container: mapRef,
      ...(mapOptions || {}),
    })
    setMap(_map)
  })

  onCleanup(() => {
    map()?.dispose()
  })

  createUpdateEffect(
    () => props.center,
    () => {
      props.center && map?.()?.setCenter(props.center)
    },
  )
  createUpdateEffect(
    () => props.zoom,
    () => {
      typeof props.zoom === 'number' && map?.()?.setZoom(props.zoom)
    },
  )
  createUpdateEffect(
    () => props.bearing,
    () => {
      typeof props.bearing === 'number' && map?.()?.setBearing(props.bearing)
    },
  )
  createUpdateEffect(
    () => props.pitch,
    () => {
      typeof props.pitch === 'number' && map?.()?.setPitch(props.pitch)
    },
  )
  return (
    <MapContext.Provider value={{ map }}>
      <div class={props.class} ref={mapRef!} />
      {props.children}
    </MapContext.Provider>
  )
}

export default Map
