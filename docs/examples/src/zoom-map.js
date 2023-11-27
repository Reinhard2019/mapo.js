import { LineLayer, Map } from 'mapo.js'
import anime from 'animejs'
import FPSControl from '@mapo.js/fps-control'

const map = new Map({
  container: '#map',
  hash: true,
  terrain: {
    exaggeration: 5,
  },
})

map.addControl(new FPSControl())

const lineLayer = new LineLayer({
  source: {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [10, 10],
        [-10, -10],
      ],
    },
  },
  style: {
    lineColor: 'red',
  },
})
map.addLayer(lineLayer)

map.addEventListener('click', () => {
  const targets = {
    zoom: 2,
    pitch: 0,
    lng: 0,
    lat: 0,
    bearing: 0,
  }
  anime({
    targets,
    zoom: 12.5,
    pitch: 75,
    lng: 115.6,
    lat: 26,
    bearing: -152.1,
    delay: 1000,
    duration: 3000,
    easing: 'linear',
    update: () => {
      map.setZoom(targets.zoom)
      map.setPitch(targets.pitch)
      map.setBearing(targets.bearing)
      map.setCenter([targets.lng, targets.lat])
    },
  })
})
