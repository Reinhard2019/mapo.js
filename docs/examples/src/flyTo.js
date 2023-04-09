import { Map } from 'mapo.js'
import FPSControl from 'fps-control'

const map = new Map({
  container: '#map',
})

map.addControl(new FPSControl())

setTimeout(() => {
  // TODO bug: 存在 bearing 和 pitch 的时候会崩溃
  map.flyTo({
    duration: 2000,
    center: [100, 45],
    zoom: 4,
  })
}, 1000)
