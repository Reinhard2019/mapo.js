import { LngLat } from '../types'
import BaseBeforeLayer from './BaseBeforeLayer'

class TextLayer extends BaseBeforeLayer {
  source: Array<GeoJSON.Feature<GeoJSON.Point>>

  constructor(params: { source: Array<GeoJSON.Feature<GeoJSON.Point>> }) {
    super()
    this.source = params.source
  }

  refresh() {
    const { canvas, ctx, source } = this

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const fontSize = 12
    ctx.font = `${fontSize}px sans-serif`
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    source.forEach(feature => {
      const lngLat = feature.geometry.coordinates as LngLat

      const point = this.beforeLayerManager?.map.project(lngLat)
      if (!point) return

      const [x, y] = point
      const text = feature.properties?.name
      const textMetrics = ctx.measureText(text)
      const left = x - textMetrics.width / 2
      const right = x + textMetrics.width / 2
      const top = y + fontSize / 2
      const bottom = y - fontSize / 2
      if (top >= 0 && left >= 0 && bottom <= canvas.height && right <= canvas.width) {
        ctx.fillText(text, x, y)
      }
    })
  }
}

export default TextLayer
