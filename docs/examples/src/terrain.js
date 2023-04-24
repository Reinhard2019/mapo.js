import { Map } from 'mapo.js'
import FPSControl from '@mapo.js/fps-control'

const map = new Map({
  container: '#map',
  terrain: {
    exaggeration: 50,
  },
})

map.addControl(new FPSControl())
