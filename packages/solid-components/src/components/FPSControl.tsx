import { Component, onCleanup, onMount, useContext } from 'solid-js'
import { MapContext } from './mapContext'
import _FPSControl from '@mapo.js/fps-control'

const FPSControl: Component = () => {
  const { map } = useContext(MapContext)
  onMount(() => {
    const _map = map?.()
    if (!_map) return

    const control = new _FPSControl()
    _map.addControl(control)

    onCleanup(() => {
      map?.()?.removeControl(control)
    })
  })

  return null
}

export default FPSControl
