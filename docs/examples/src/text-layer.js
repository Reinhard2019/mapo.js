import { Map, TextLayer } from 'mapo.js'

const map = new Map({
  container: '#map',
  center: [116.405285, 39.904989],
})

fetch('/json/100000_full.json')
  .then(resp => resp.json())
  .then(resp => {
    const data = resp.features
      .filter(f => f.properties.center)
      .map(f => ({
        type: 'Feature',
        properties: {
          name: f.properties.name,
        },
        geometry: {
          type: 'Point',
          coordinates: f.properties.center,
        },
      }))
    const textLayer = new TextLayer({
      source: data,
      textField: 'name',
    })
    map.addLayer(textLayer)
  })
