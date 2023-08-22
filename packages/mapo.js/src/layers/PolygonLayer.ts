import { MultiPolygon, Polygon, Position } from 'geojson'
import { Features } from 'src/types'
import { features2featureArr } from 'src/utils/layers'
import geoEquirectangular from '../utils/geoEquirectangular'
import CanvasLayer from './CanvasLayer'
import { BBox } from '../types'

type Source = Features<Polygon | MultiPolygon>

interface Style {
  fillColor?: string
}

class PolygonLayer extends CanvasLayer<Source, Style> {
  draw(options: { bbox: BBox; pxDeg: number; canvas: OffscreenCanvas }) {
    const { canvas, bbox } = options
    const { source, style } = this

    // console.time('OffscreenCanvas')
    // // const _canvas = new OffscreenCanvas(canvas.width, canvas.height)
    // console.timeEnd('OffscreenCanvas')

    // console.time('getContext')
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
    // console.timeEnd('getContext')

    // console.time('clearRect')
    // // ctx.clearRect(0, 0, canvas.width, canvas.height)
    // console.timeEnd('clearRect')

    const projection = geoEquirectangular({
      bbox,
      size: [canvas.width, canvas.height],
    })

    // console.time('features2featureArr')
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
    // console.timeEnd('features2featureArr')
  }
}

export default PolygonLayer
