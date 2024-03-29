import { Point } from 'geojson'
import { BBox, Features, LngLat, Point2 } from '../types'
import { features2featureArr } from '../utils/layers'
import * as THREE from 'three'
import { get, mapKeys, mapValues } from 'lodash-es'
import { bboxContain, bboxOverlap } from '../utils/bbox'
import { lngLatToVector3 } from '../utils/map'
import { degToRad } from '../utils/math'
import PointLayerManager from './PointLayerManager'
import { chain } from '../utils'
import Layer from './Layer'

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

const defaultStyle = {
  fontSize: 12,
  textColor: 'white',
  textAlign: 'center',
  textBaseline: 'middle',
}

function style2ContextStyle(style: Style | undefined) {
  return chain(Object.assign({}, defaultStyle, style))
    .next(prevInput =>
      mapKeys(prevInput, (_, key) => {
        if (key === 'textColor') return 'fillStyle'
        if (key === 'fontSize') return 'font'
        return key
      }),
    )
    .next(prevInput =>
      mapValues(prevInput, (value, key) => {
        if (key === 'font') return `${value as number}px sans-serif`
        return value
      }),
    )
    .value() as {} as CanvasTextDrawingStyles & CanvasFillStrokeStyles
}

class TextSprite extends THREE.Sprite {
  constructor(options: {
    text: string
    fontSize: number
    textWidth: number
    spriteSize: number
    position: THREE.Vector3
    styles: CanvasTextDrawingStyles & CanvasFillStrokeStyles
  }) {
    // TODO 将宽高各乘以 2 以满足 textAlign 和 textBaseline 的各种情况
    const canvas = new OffscreenCanvas(options.textWidth, options.fontSize)
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D

    Object.assign(ctx, options.styles)
    ctx.fillText(options.text, canvas.width / 2, canvas.height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      sizeAttenuation: false,
    })

    super(spriteMaterial)

    this.position.copy(options.position)
    const { spriteSize } = options
    this.scale.set(canvas.width / spriteSize, canvas.height / spriteSize, 1)
  }

  dispose() {
    this.material?.dispose()
    this.material?.map?.dispose()
  }
}

class PointLayer extends Layer<Source, Style> {
  textField: string
  canvas = new OffscreenCanvas(1, 1)
  ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  private pointLayerManager: PointLayerManager
  readonly group = new THREE.Group()
  needsUpdate = false

  constructor(options: { source: Source; style?: Style; textField: string }) {
    super(options)

    this.textField = options.textField
  }

  setPointLayerManager(pointLayerManager: PointLayerManager) {
    this.pointLayerManager = pointLayerManager
  }

  update() {
    if (!this.needsUpdate) return
    this.needsUpdate = false

    const { canvas, ctx, source, style, textField } = this
    const { map } = this.pointLayerManager

    this.group.children.forEach((child: TextSprite) => {
      child.dispose()
    })
    this.group.children = []

    canvas.width = map.container.clientWidth
    canvas.height = map.container.clientHeight

    const { fov } = map.earthOrbitControls
    const spriteSize = map.container.clientHeight / (2 * Math.tan(degToRad(fov / 2))) // px

    const contextStyles = style2ContextStyle(style)
    Object.assign(ctx, contextStyles)

    const fontSize = style?.fontSize ?? defaultStyle.fontSize
    const bboxArr: BBox[] = []

    features2featureArr(source).forEach(feature => {
      const lngLat = feature.geometry.coordinates as LngLat

      const point = map.project(lngLat)
      if (!point) return

      const [x, y] = point as Point2
      const text = get(feature.properties, textField)
      if (!text) return

      const textMetrics = ctx.measureText(text)
      const left = x - textMetrics.width / 2
      const right = x + textMetrics.width / 2
      const top = y - fontSize / 2
      const bottom = y + fontSize / 2
      const textBBox: BBox = [left, top, right, bottom]
      if (!bboxContain([0, 0, canvas.width, canvas.height], textBBox)) {
        return
      }

      if (!style?.overlap && bboxArr.some(bbox => bboxOverlap(bbox, textBBox))) {
        return
      }

      bboxArr.push(textBBox)

      const textSprite = new TextSprite({
        text,
        fontSize,
        position: lngLatToVector3(lngLat, map.earthRadius),
        spriteSize,
        textWidth: textMetrics.width,
        styles: contextStyles,
      })
      this.group.add(textSprite)
    })
  }
}

export default PointLayer
