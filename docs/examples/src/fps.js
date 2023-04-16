import { Map } from 'mapo.js'
import FPSControl from '@mapo.js/fps-control'

const map = new Map({
  container: '#map',
})

map.addControl(new FPSControl())
