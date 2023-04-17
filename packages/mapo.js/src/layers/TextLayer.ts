import { Point } from 'geojson'
import { bboxContains, bboxOverlap } from 'src/utils/bbox'
import { features2featureArr } from 'src/utils/layers'
import { BBox, Features, LngLat } from '../types'
import BaseBeforeLayer from './BaseBeforeLayer'
import { get } from 'lodash-es'

type Source = Features<Point>

interface Style {
  /**
   * 文字是否可以重叠
   * 默认为 false
   */
  overlap?: boolean
  /**
   * 字体大小，单位是 px
   * 默认为 12
   */
  fontSize?: number
  /**
   * 字体颜色
   */
  textColor?: string
}

class TextLayer extends BaseBeforeLayer<Source, Style> {
  textField: string

  constructor(options: { source: Source; style?: Style; textField: string }) {
    super(options)

    this.textField = options.textField
  }

  refresh() {
    const { canvas, ctx, source, style, textField } = this

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let fontSize = 12
    if (style) {
      if (typeof style.fontSize === 'number') {
        fontSize = style.fontSize
      }
      if (style.textColor) {
        ctx.fillStyle = style.textColor
      }
    }
    ctx.font = `${fontSize}px sans-serif`

    const bboxArr: BBox[] = []
    features2featureArr(source).forEach(feature => {
      const lngLat = feature.geometry.coordinates as LngLat

      const point = this.beforeLayerManager?.map.project(lngLat)
      if (!point) return

      const [x, y] = point
      const text = get(feature.properties, textField) ?? ''
      const textMetrics = ctx.measureText(text)
      const left = x - textMetrics.width / 2
      const right = x + textMetrics.width / 2
      const top = y - fontSize / 2
      const bottom = y + fontSize / 2
      const textBBox: BBox = [left, top, right, bottom]
      if (!bboxContains([0, 0, canvas.width, canvas.height], textBBox)) {
        return
      }

      if (!style?.overlap && bboxArr.some(bbox => bboxOverlap(bbox, textBBox))) {
        return
      }

      ctx.fillText(text, x, y)
      bboxArr.push(textBBox)
    })
  }
}

export default TextLayer
