import * as d3 from 'd3'
import { inflate } from '../utils/array'
import Layer from './Layer'

type Source = GeoJSON.Feature<GeoJSON.Polygon> | Array<GeoJSON.Feature<GeoJSON.Polygon>>

class FillLayer extends Layer {
  private readonly canvas = document.createElement('canvas')
  private readonly ctx: CanvasRenderingContext2D
  source: Source

  constructor (params: {
    source: Source
  }) {
    super()
    this.source = params.source
    this.ctx = this.canvas.getContext('2d')!
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
      coordinates.forEach((positions) => {
        positions.forEach((position, i) => {
          const point = projection(position as [number, number])
          const [x, y] = point!
          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        })
      })
    })
    ctx.fillStyle = 'green'
    ctx.lineWidth = 10
    ctx.fill()

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    void createImageBitmap(imageData).then(imageBitmap => {
      this.imageBitmap = imageBitmap
      this.dispatchEvent({ type: 'update' })
    })
  }
}

export default FillLayer
