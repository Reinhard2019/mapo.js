import { MultiPolygon, Polygon, Position } from 'geojson'
import { Features } from 'src/types'
import { features2featureArr } from 'src/utils/layers'
import geoEquirectangular from '../utils/geoEquirectangular'
import CanvasLayer, { DrawOptions } from './CanvasLayer'

type Source = Features<Polygon | MultiPolygon>

interface Style {
  /**
   * 是否填充
   * 默认为 true
   */
  fill?: boolean
  fillColor?: string
  borderColor?: string
  borderWidth?: number
}

class PolygonLayer extends CanvasLayer<Source, Style> {
  draw(options: DrawOptions) {
    const { ctx, bbox } = options
    const { source, style } = this
    const mergedStyle = Object.assign<Style, Style>(
      {
        fill: true,
      },
      style ?? {},
    )

    if (!mergedStyle.fill && !mergedStyle.borderWidth) return

    if (mergedStyle.fillColor) {
      ctx.fillStyle = mergedStyle.fillColor
    }
    if (mergedStyle.borderWidth) {
      ctx.lineWidth = mergedStyle.borderWidth
    }
    if (mergedStyle.borderColor) {
      ctx.strokeStyle = mergedStyle.borderColor
    }

    const projection = geoEquirectangular({
      bbox,
      size: [ctx.canvas.width, ctx.canvas.height],
    })

    ctx.beginPath()

    features2featureArr(source).forEach(feature => {
      let coordinates: Position[][] = []
      if (feature.geometry.type === 'MultiPolygon') {
        coordinates = feature.geometry.coordinates.map(polygonCoordinates => polygonCoordinates[0])
      } else {
        coordinates = feature.geometry.coordinates.slice(0, 1)
      }
      coordinates.forEach(positions => {
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

    if (mergedStyle.fill) {
      ctx.fill()
    }
    if (mergedStyle.borderWidth) {
      ctx.stroke()
    }
  }
}

export default PolygonLayer
