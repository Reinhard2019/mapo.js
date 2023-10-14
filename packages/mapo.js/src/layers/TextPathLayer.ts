/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { LineString, MultiLineString, Position } from 'geojson'
import { Features } from 'src/types'
import CanvasLayer, { DrawOptions } from './CanvasLayer'
import geoEquirectangular from 'src/utils/geoEquirectangular'
import { features2featureArr } from 'src/utils/layers'
import { get, isEmpty, sum } from 'lodash-es'
import * as THREE from 'three'
import { cleanLine, getClosestSegmentInfo, getAngle, getPointBySegmentInfo } from 'src/utils/math'
import { fract } from 'src/utils/number'

type Source = Features<LineString | MultiLineString>

interface Style {
  /**
   * 文字是否可以重叠
   * 默认为 false
   */
  overlap?: boolean
  /**
   * 字体大小
   * 单位是 px
   * 默认为 12
   */
  fontSize?: number
  /**
   * 字体颜色
   */
  textColor?: string
  /**
   * 文字对齐方式
   * 默认为 'center'
   */
  textAlign?: 'left' | 'center' | 'right'
  /**
   * 文字基线
   * 为数字时单位为 px
   * 默认为 'middle'
   */
  textBaseline?: CanvasTextBaseline | number
  /**
   * 字符间距
   * 文字不重复时有效
   * 单位是 px
   * 默认为 0
   */
  letterSpacing?: number
  /**
   * 词间距
   * 单位是 px
   * 默认为 0
   */
  wordSpacing?: number
  /**
   * 文字间距
   * 单位是 px
   * 默认为 0
   */
  textPadding?: number | [number, number]
  /**
   * 文字是否重复
   * 默认为 true
   */
  repeat?: boolean
  /**
   * 文字是否允许溢出
   * 文字重复时有效
   * 默认为 true
   */
  overflow?: boolean
}

const defaultStyle = {
  fontSize: 12,
  textColor: 'white',
  textBaseline: 'middle' as const,
}

function setContextStyle(ctx: OffscreenCanvasRenderingContext2D, style: Style | undefined) {
  const mergedStyle = Object.assign({}, defaultStyle, style)
  ctx.font = `${mergedStyle.fontSize}px sans-serif`
  ctx.fillStyle = mergedStyle.textColor
  ctx.textBaseline =
    typeof mergedStyle.textBaseline === 'string'
      ? mergedStyle.textBaseline
      : defaultStyle.textBaseline
}

class TextPathLayer extends CanvasLayer<Source, Style> {
  private readonly textField: string

  constructor(options: { source: Source; style?: Style; textField: string }) {
    super(options)

    Object.assign(this, options)
  }

  draw(options: DrawOptions) {
    const { ctx, bbox, pxDeg } = options
    const { source, style, textField } = this

    const {
      wordSpacing = 0,
      textPadding = 0,
      repeat = true,
      overflow = true,
      textBaseline,
      textAlign = 'center',
    } = style ?? {}
    const leftTextPadding = Array.isArray(textPadding) ? textPadding[0] : textPadding
    const rightTextPadding = Array.isArray(textPadding) ? textPadding[1] : textPadding

    setContextStyle(ctx, style)

    const projection = geoEquirectangular({
      bbox,
      size: [ctx.canvas.width, ctx.canvas.height],
    })

    // 文字
    features2featureArr(source).forEach(feature => {
      let lineStringArr: Position[][] = []
      if (feature.geometry.type === 'LineString') {
        lineStringArr = [feature.geometry.coordinates]
      } else if (feature.geometry.type === 'MultiLineString') {
        lineStringArr = feature.geometry.coordinates
      }

      const text = get(feature.properties, textField) as string

      if (text.length === 0) return

      lineStringArr.forEach(positions => {
        if (isEmpty(positions)) return

        const line: THREE.Vector2[] = cleanLine(
          positions.map(p => new THREE.Vector2(...p)),
          pxDeg,
        ).map(p => new THREE.Vector2(...projection(p.toArray())))

        const totalDistance = sum(line.map((p, i) => (i === 0 ? 0 : p.distanceTo(line[i - 1]))))
        const textWidth = ctx.measureText(text).width
        const totalWordSpacingOfText = wordSpacing * Array.from(text).filter(t => t === ' ').length

        const singleLetter = text.length === 1
        let letterSpacing = style?.letterSpacing ?? 0
        if (!repeat) {
          letterSpacing = singleLetter
            ? 0
            : (totalDistance -
                textWidth -
                totalWordSpacingOfText -
                leftTextPadding -
                rightTextPadding) /
              (text.length - 1)
        }

        let repeatCountInt = 1
        let currentDistance = 0

        if (repeat) {
          // 小数部分
          let repeatCountDecimal = 0

          const repeatCount =
            totalDistance /
            (textWidth +
              letterSpacing * (text.length - 1) +
              totalWordSpacingOfText +
              leftTextPadding +
              rightTextPadding)
          switch (textAlign) {
            case 'center': {
              if (repeatCount > 1) {
                let halfRepeatCount = (repeatCount - 1) / 2
                repeatCountDecimal = fract(halfRepeatCount)
                halfRepeatCount = overflow
                  ? Math.ceil(halfRepeatCount)
                  : Math.floor(halfRepeatCount)
                repeatCountInt = 1 + halfRepeatCount * 2
              } else {
                repeatCountInt = overflow ? Math.ceil(repeatCount) : Math.floor(repeatCount)
                repeatCountDecimal = repeatCount
              }

              if (repeatCountDecimal > 0) {
                repeatCountDecimal = overflow ? repeatCountDecimal - 1 : repeatCountDecimal
              }
              break
            }
            case 'left':
              repeatCountInt = overflow ? Math.ceil(repeatCount) : Math.floor(repeatCount)
              break
            case 'right':
              repeatCountInt = overflow ? Math.ceil(repeatCount) : Math.floor(repeatCount)
              repeatCountDecimal = fract(repeatCount)

              if (repeatCountDecimal > 0) {
                repeatCountDecimal = overflow ? repeatCountDecimal - 1 : repeatCountDecimal
              }
              break
          }

          currentDistance = (repeatCountDecimal / repeatCount) * totalDistance
        } else {
          currentDistance = singleLetter
            ? (totalDistance - textWidth - leftTextPadding - rightTextPadding) / 2
            : 0
        }

        for (let repeatIndex = 0; repeatIndex < repeatCountInt; repeatIndex++) {
          Array.from(text).forEach((letter, letterIndex) => {
            if (letterIndex === 0) {
              currentDistance += leftTextPadding
            }

            const segmentInfo = getClosestSegmentInfo(line, currentDistance)
            const letterStart = getPointBySegmentInfo(line, segmentInfo)

            const letterWidth = ctx.measureText(letter).width
            const halfLetterWidth = letterWidth / 2
            currentDistance += letterWidth
            if (letterIndex === text.length - 1) {
              currentDistance += rightTextPadding
            } else {
              currentDistance += letterSpacing
            }
            if (letter === ' ') {
              currentDistance += wordSpacing
            }

            const beyond = segmentInfo.index >= line.length - 1
            const slicedLine = beyond
              ? [letterStart, line[line.length - 2]]
              : [letterStart, ...line.slice(segmentInfo.index + 1)]
            const letterEndInfo = getClosestSegmentInfo(
              slicedLine,
              beyond ? -letterWidth : letterWidth,
            )
            const letterEnd = getPointBySegmentInfo(slicedLine, letterEndInfo)

            const letterCenterInfo = getClosestSegmentInfo(
              slicedLine,
              beyond ? -halfLetterWidth : halfLetterWidth,
            )
            const letterCenter = getPointBySegmentInfo(slicedLine, letterCenterInfo)

            const angle = getAngle(letterStart, letterEnd)

            ctx.save()
            ctx.textAlign = 'center'
            ctx.translate(letterCenter.x, letterCenter.y)
            if (typeof textBaseline === 'number') {
              ctx.translate(0, -textBaseline)
            }
            ctx.rotate(angle)
            ctx.fillText(letter, 0, 0)
            ctx.restore()
          })
        }
      })
    })
  }
}

export default TextPathLayer
