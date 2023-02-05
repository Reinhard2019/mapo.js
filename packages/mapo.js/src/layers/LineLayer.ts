import * as d3 from 'd3'
import { inflate } from '../utils/array'
import Layer from './Layer'

type Source = GeoJSON.Feature<GeoJSON.LineString> | Array<GeoJSON.Feature<GeoJSON.LineString>>

class LineLayer extends Layer {
  private readonly canvas = new OffscreenCanvas(0, 0)
  private readonly ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  source: Source

  constructor (params: {
    source: Source
  }) {
    super()
    this.source = params.source
  }

  refresh () {
    const { canvas, ctx, layerManager, source } = this
    const { bbox } = layerManager!
    const [w, , e, n] = bbox

    canvas.width = layerManager!.canvas.width
    canvas.height = layerManager!.canvas.height
    const width = canvas.width / ((e - w) / 360)
    const projection = d3.geoEquirectangular()
      .translate([0, 0])
      .center([w, n])
      .scale(width / (2 * Math.PI))

    ctx.beginPath()
    inflate(source).forEach(feature => {
      const coordinates = feature.geometry.coordinates
      coordinates.forEach((position, i) => {
        const point = projection(position as [number, number])
        const [x, y] = point!
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
    })
    ctx.strokeStyle = 'red'
    ctx.lineWidth = 10
    ctx.stroke()

    this.imageBitmap = canvas.transferToImageBitmap()
    this.dispatchEvent({ type: 'update' })
  }
}

export default LineLayer
