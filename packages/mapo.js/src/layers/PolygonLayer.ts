import { MultiPolygon, Polygon, Position } from 'geojson'
import { Features } from 'src/types'
import { features2featureArr } from 'src/utils/layers'
import geoEquirectangular from '../utils/geoEquirectangular'
import CanvasLayer, { DrawOptions } from './CanvasLayer'

type Source = Features<Polygon | MultiPolygon>

interface Style {
  fillColor?: string
}

class PolygonLayer extends CanvasLayer<Source, Style> {
  draw(options: DrawOptions) {
    const { ctx, bbox } = options
    const { source, style } = this

    const projection = geoEquirectangular({
      bbox,
      size: [ctx.canvas.width, ctx.canvas.height],
    })

    ctx.beginPath()
    if (style) {
      if (style.fillColor) {
        ctx.fillStyle = style.fillColor
      }
    }

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

    ctx.fill()
  }
}

export default PolygonLayer
