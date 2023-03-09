import { Map } from 'mapo.js'
import FPSControl from 'fps-control'

const map = new Map({
  container: '#map',
})

map.addControl(new FPSControl())
