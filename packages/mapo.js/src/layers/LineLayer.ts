import * as d3 from 'd3'
import { inflate } from '../utils/array'
import Layer from './Layer'

type Source = GeoJSON.Feature<GeoJSON.LineString> | Array<GeoJSON.Feature<GeoJSON.LineString>>

class LineLayer extends Layer {
  private readonly canvas = document.createElement('canvas')
  private readonly ctx: CanvasRenderingContext2D
  source: Source

  constructor (params: {
    source: Source
  }) {
    super()
    this.source = params.source
    this.ctx = this.canvas.getContext('2d')
  }

  update () {
    const { canvas, ctx, layerManager, source } = this
    // const { bbox } = layerManager
    // const [w, , e, n] = bbox

    canvas.width = layerManager.canvas.width
    canvas.height = layerManager.canvas.height
    // const width = canvas.width / ((e - w) / 360)
    const projection = d3.geoEquirectangular()
    // .translate([0, 0])
    // .center([w, n])
    // .scale(width / (2 * Math.PI))
    // .preclip(stream => stream)
    // .postclip(stream => stream)
    console.log('projection.clipAngle', projection.clipAngle())

    const path = d3.geoPath(projection, ctx)

    ctx.beginPath()
    path({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 50],
              [90, 80],
            ]
          }
        }
      ]
    })
    ctx.strokeStyle = 'red'
    ctx.stroke()

    ctx.beginPath()
    path({
      type: 'FeatureCollection',
      features: inflate(source)
    })
    ctx.strokeStyle = 'red'
    ctx.stroke()

    ctx.beginPath()
    path({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 50],
                [60, 60],
                [60, -60],
                [0, 50],
              ]
            ]
          }
        }
      ]
    })
    ctx.fillStyle = 'red'
    ctx.fill()

    // console.log({
    //   type: 'FeatureCollection',
    //   features: inflate(source),
    // })

    // inflate(source).forEach(feature => {
    //   const coordinates = feature.geometry.coordinates
    //   ctx.strokeStyle = 'red'
    //   ctx.beginPath()
    //   coordinates.forEach((position, i) => {
    //     const point = projection(position as [number, number])
    //     const [x, y] = point
    //     if (i === 0) {
    //       ctx.moveTo(x, y)
    //     } else {
    //       ctx.lineTo(x, y)
    //     }
    //   })
    //   ctx.stroke()
    // })

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    void createImageBitmap(imageData).then(imageBitmap => {
      this.imageBitmap = imageBitmap
      this.dispatchEvent({ type: 'update' })
    })
  }
}

export default LineLayer
