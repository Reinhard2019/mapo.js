import { Map, PolygonLayer, LineLayer } from 'mapo.js'

const map = new Map({
  container: '#map',
  center: [116.405285, 39.904989],
  zoom: 8,
  bearing: 45,
  pitch: 70,
  terrain: {
    exaggeration: 20,
  },
})

fetch('/json/100000_full.json')
  .then(resp => resp.json())
  .then(resp => {
    const polygonLayer = new PolygonLayer({
      source: resp,
      style: {
        fillColor: '#ff0',
      },
    })
    map.addLayer(polygonLayer)

    const lineLayer = new LineLayer({
      source: resp,
      style: {
        lineColor: '#f00',
      },
    })
    map.addLayer(lineLayer)
  })
