import { Map, LineLayer } from 'mapo.js'

const map = new Map({
  container: '#map',
  center: [116.405285, 39.904989],
})

fetch('/json/100000_full.json')
  .then(resp => resp.json())
  .then(resp => {
    const lineLayer = new LineLayer({
      source: resp,
      style: {
        lineColor: '#fff',
      },
    })
    map.addLayer(lineLayer)
  })
