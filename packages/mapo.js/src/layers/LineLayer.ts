import { LineString, Polygon, MultiPolygon, MultiLineString, Position } from 'geojson'
import { Features } from '../types'
import { features2featureArr } from '../utils/layers'
import { mapKeys, mapValues } from 'lodash-es'
import CanvasLayer, { DrawOption } from './CanvasLayer'
import { chain } from '../utils'

type Source = Features<LineString | MultiLineString | Polygon | MultiPolygon>

interface Style {
  lineColor?: string
  lineWidth?: number
  lineCap?: CanvasLineCap
  lineJoin?: CanvasLineJoin
  lineBlur?: number
}

class LineLayer extends CanvasLayer<Source, Style> {
  draw(options: DrawOption) {
    const { ctx } = options
    const { source, style } = this
    const projection = this.getProjection(options)

    ctx.beginPath()

    Object.assign(
      ctx,
      chain(
        mapValues(style, (value, key) => {
          if (key === 'lineBlur') {
            return `blur(${value ?? 0}px)`
          }
          return value
        }),
      )
        .next(s =>
          mapKeys(s, (_, key) => {
            switch (key) {
              case 'lineColor':
                return 'strokeStyle'
              case 'lineBlur':
                return 'filter'
              default:
                return key
            }
          }),
        )
        .value(),
    )

    features2featureArr(source).forEach(feature => {
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
  }
}

export default LineLayer
