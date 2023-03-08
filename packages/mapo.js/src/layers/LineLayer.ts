import { LineString, Polygon, MultiPolygon, MultiLineString, Position } from 'geojson'
import { Features } from 'src/types'
import { inflate } from '../utils/array'
import geoEquirectangular from '../utils/geoEquirectangular'
import BaseLayer from './BaseLayer'

type Source =
  | Features<LineString>
  | Features<MultiLineString>
  | Features<Polygon>
  | Features<MultiPolygon>

interface Style {
  lineColor?: string
  lineWidth?: number
}

class LineLayer extends BaseLayer {
  private readonly canvas = new OffscreenCanvas(1, 1)
  private readonly ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  source: Source
  style?: Style

  constructor(options: { source: Source; style?: Style }) {
    super()
    this.source = options.source
    this.style = options.style
  }

  refresh() {
    const { canvas, ctx, layerManager, source, style } = this

    canvas.width = layerManager!.canvas.width
    canvas.height = layerManager!.canvas.height
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const projection = geoEquirectangular({
      bbox: this.layerManager!.bbox,
      size: [this.layerManager!.canvas.width, this.layerManager!.canvas.height],
    })

    ctx.beginPath()

    if (style) {
      if (style.lineColor) {
        this.ctx.strokeStyle = style.lineColor
      }
      if (typeof style.lineWidth === 'number') {
        this.ctx.lineWidth = style.lineWidth
      }
    }

    const features =
      !Array.isArray(source) && source.type === 'FeatureCollection'
        ? source.features
        : inflate(source)
    features.forEach(feature => {
      let lineStringArr: Position[][] = []
      if (feature.geometry.type === 'LineString') {
        lineStringArr = [feature.geometry.coordinates]
      } else if (feature.geometry.type === 'MultiLineString') {
        lineStringArr = feature.geometry.coordinates
      } else if (feature.geometry.type === 'Polygon') {
        // TODO Polygon 支持中空（第一个环必须是外部环，其他的必须是内部环或者孔，而且内部环和外部环的走向是相反的）
        lineStringArr = feature.geometry.coordinates.slice(0, 1)
      } else {
        lineStringArr = feature.geometry.coordinates.map(
          polygonCoordinates => polygonCoordinates[0],
        )
      }

      lineStringArr.forEach(positions => {
        positions.forEach((position, i) => {
          const [x, y] = projection(position)
          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        })
      })
    })

    ctx.stroke()

    this.imageBitmap = canvas.transferToImageBitmap()
  }
}

export default LineLayer
