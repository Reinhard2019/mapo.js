import { geoEquirectangular } from 'd3'
import Layer from './Layer'

class TextLayer extends Layer {
  private readonly canvas = new OffscreenCanvas(0, 0)
  private readonly ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  source: Array<GeoJSON.Feature<GeoJSON.Point>>

  constructor (params: {
    source: Array<GeoJSON.Feature<GeoJSON.Point>>
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
    const projection = geoEquirectangular()
      .translate([0, 0])
      .center([w, n])
      .scale(width / (2 * Math.PI))

    const fontSize = 12
    ctx.font = `${fontSize}px`
    ctx.fillStyle = 'red'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    source.forEach(feature => {
      const point = projection(feature.geometry.coordinates as [number, number])
      const [_x, _y] = point!
      const x = Math.round(_x)
      const y = Math.round(_y)
      const text = feature.properties?.name
      const textMetrics = ctx.measureText(text)
      const left = x - textMetrics.width / 2
      const right = x + textMetrics.width / 2
      const top = y + fontSize / 2
      const bottom = y - fontSize / 2
      if (top >= 0 && left >= 0 && bottom <= canvas.height && right <= canvas.width) {
        ctx.fillText(text, point![0], point![1])
      }
    })

    this.imageBitmap = canvas.transferToImageBitmap()
    this.dispatchEvent({ type: 'update' })
  }
}

export default TextLayer
