import { MultiPolygon, Polygon, Position } from 'geojson'
import { Features } from 'src/types'
import { features2featureArr } from 'src/utils/layers'
import geoEquirectangular from '../utils/geoEquirectangular'
import CanvasLayerManager from './CanvasLayerManager'
import CanvasLayer from './CanvasLayer'
import { BBox } from '../types'

type Source = Features<Polygon | MultiPolygon>

interface Style {
  fillColor?: string
}

class PolygonLayer extends CanvasLayer<Source, Style> {
  private readonly canvas = new OffscreenCanvas(1, 1)
  private readonly ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  layerManager?: CanvasLayerManager
  imageBitmap?: ImageBitmap

  draw(options: { bbox: BBox; pxDeg: number; canvas: OffscreenCanvas }) {
    const { canvas, bbox } = options
    const { source, style } = this

    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const projection = geoEquirectangular({
      bbox,
      size: [canvas.width, canvas.height],
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

    this.imageBitmap = canvas.transferToImageBitmap()
  }
}

export default PolygonLayer
