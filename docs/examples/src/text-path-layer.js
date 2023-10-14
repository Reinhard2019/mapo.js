import { Map, LineLayer, TextPathLayer } from 'mapo.js'

const map = new Map({
  container: '#map',
  zoom: 6,
  center: [116, 30.5],
})

fetch('/json/长江.json')
  .then(resp => resp.json())
  .then(resp => {
    const lineLayer = new LineLayer({
      source: resp,
      style: {
        lineColor: '#fff',
        lineWidth: 2,
      },
    })
    map.addLayer(lineLayer)

    resp.properties.name = '长江 防线'
    const textPathLayer = new TextPathLayer({
      source: resp,
      textField: 'name',
      style: {
        fontSize: 24,
        textColor: 'red',
        letterSpacing: 4,
        wordSpacing: 10,
        textPadding: [10, 20],
        overflow: false,
        textBaseline: 'top',
        textAlign: 'right',
      },
    })
    map.addLayer(textPathLayer)
  })
