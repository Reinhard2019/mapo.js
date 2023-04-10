import { Map } from 'mapo.js'
import FPSControl from 'fps-control'

const map = new Map({
  container: '#map',
})

map.addControl(new FPSControl())

setTimeout(() => {
  map.flyTo({
    duration: 2000,
    center: [100, 45],
    zoom: 3,
    bearing: 45,
    pitch: 45,
  })
}, 1000)
