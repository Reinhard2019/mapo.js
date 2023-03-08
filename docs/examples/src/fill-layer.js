import { Map, FillLayer, LineLayer } from 'mapo.js'

const map = new Map({
  container: '#map',
  center: [116.405285, 39.904989],
  zoom: 3,
})

fetch('/json/100000_full.json')
  .then(resp => resp.json())
  .then(resp => {
    const fillLayer = new FillLayer({
      source: resp,
      style: {
        fillColor: '#ff0',
      },
    })
    map.addLayer(fillLayer)

    const lineLayer = new LineLayer({
      source: resp,
      style: {
        lineColor: '#f00',
      },
    })
    map.addLayer(lineLayer)
  })
