import { inflate } from '../utils/array'
import geoEquirectangular from '../utils/geoEquirectangular'
import BaseLayer from './BaseLayer'

type Source = GeoJSON.Feature<GeoJSON.LineString> | Array<GeoJSON.Feature<GeoJSON.LineString>>

class LineLayer extends BaseLayer {
  private readonly canvas = new OffscreenCanvas(1, 1)
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

    canvas.width = layerManager!.canvas.width
    canvas.height = layerManager!.canvas.height
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const projection = geoEquirectangular({
      bbox: this.layerManager!.bbox,
      size: [this.layerManager!.canvas.width, this.layerManager!.canvas.height]
    })

    ctx.beginPath()
    inflate(source).forEach(feature => {
      const coordinates = feature.geometry.coordinates
      coordinates.forEach((position, i) => {
        const [x, y] = projection(position)
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
    })
    ctx.strokeStyle = 'red'
    ctx.lineWidth = 50
    ctx.stroke()

    this.imageBitmap = canvas.transferToImageBitmap()
  }
}

export default LineLayer
