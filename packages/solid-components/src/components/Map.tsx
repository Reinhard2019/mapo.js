import { Component, onCleanup, onMount, splitProps, JSXElement, createSignal } from 'solid-js'
import { Map as _Map } from 'mapo.js'
import { MapOptions, AnimationOptions } from 'mapo.js/esm/types'
import { MapContext } from './mapContext'
import createUpdateEffect from '../hooks/createUpdateEffect'
import { isNil, pick, pickBy } from 'lodash-es'

interface MapProps extends Omit<MapOptions, 'container'> {
  class?: string
  children?: JSXElement
  animationOptions?: AnimationOptions
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
    [
      () => mapOptions.center,
      () => mapOptions.zoom,
      () => mapOptions.bearing,
      () => mapOptions.pitch,
    ],
    () => {
      const options = pickBy(
        {
          ...pick(mapOptions, ['center', 'zoom', 'bearing', 'pitch']),
          ...mapOptions.animationOptions,
        },
        v => !isNil(v),
      )
      map?.()?.flyTo(options)
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
