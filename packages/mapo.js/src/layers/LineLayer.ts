import { LineString, Polygon, MultiPolygon, MultiLineString, Position, Feature } from 'geojson'
import { Features } from 'src/types'
import { features2featureArr } from 'src/utils/layers'
import geoEquirectangular from '../utils/geoEquirectangular'
import { get, mapKeys, mapValues } from 'lodash-es'
import CanvasLayer from './CanvasLayer'
import { chain } from 'src/utils'
import * as THREE from 'three'
import { simplify } from '@turf/turf'

type Source = Features<LineString | MultiLineString | Polygon | MultiPolygon>

interface Style {
  lineColor?: string
  lineWidth?: number
  lineCap?: CanvasLineCap
  lineJoin?: CanvasLineJoin
  lineBlur?: number
}

function isLineString(f: Feature): f is Feature<LineString> {
  return f.geometry.type === 'LineString'
}

class LineLayer extends CanvasLayer<Source, Style> {
  textField: string
  private readonly canvas = new OffscreenCanvas(1, 1)
  private readonly ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D

  constructor(options: { source: Source; style?: Style; textField: string }) {
    super(options)

    this.textField = options.textField
  }

  update() {
    const { canvas, ctx, layerManager, source, style, textField } = this

    canvas.width = layerManager!.canvas.width
    canvas.height = layerManager!.canvas.height
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const projection = geoEquirectangular({
      bbox: this.layerManager!.bbox,
      size: [this.layerManager!.canvas.width, this.layerManager!.canvas.height],
    })

    ctx.beginPath()

    Object.assign(
      this.ctx,
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

    // 文字
    features2featureArr(source).forEach(feature => {
      if (isLineString(feature)) {
        const text = get(feature.properties, textField)
        if (!text) return

        const textMetrics = ctx.measureText(text)

        const pxDeg = layerManager!.pxDeg
        const tolerance = 10 * pxDeg

        const simplifyFeature = simplify(feature, { tolerance })

        // 将经纬度转化为 canvas 上的位置
        const canvasPoints = simplifyFeature.geometry.coordinates.map(position =>
          projection(position),
        )

        let prevDistance = 0
        // 每一个点相对起始点的距离
        const distances = canvasPoints.map((point, i, arr) => {
          if (i === 0) return 0

          const prev = arr[i - 1]
          const vec2 = new THREE.Vector2(...point)
          prevDistance += vec2.distanceTo(new THREE.Vector2(...prev))
          return prevDistance
        })
        const totalDistance = distances.at(-1)!
        const halfTotalDistance = totalDistance / 2
        const gap = textMetrics.width
        // 每一个 text 相对于起始点的距离
        const textDistances = [halfTotalDistance]
        let currentDistance = halfTotalDistance - textMetrics.width / 2
        while (true) {
          currentDistance -= textMetrics.width + gap
          if (currentDistance <= 0) break

          textDistances.unshift(currentDistance)
          textDistances.push(totalDistance - currentDistance)
        }

        // 根据 text 相对起始点的距离获取其对应的 canvas 位置
        textDistances.forEach(distance => {
          const i = distances.findIndex(d => d >= distance)
          const prevPoint = canvasPoints[i - 1]
          const nextPoint = canvasPoints[i]

          const [x, y] = prevPoint

          ctx.save()
          Object.assign(ctx, {
            font: '12px sans-serif',
            textColor: 'white',
            textAlign: 'center',
            textBaseline: 'middle',
          })

          const rad = Math.atan((nextPoint[1] - prevPoint[1]) / (nextPoint[0] - prevPoint[0]))
          ctx.translate(x, y)
          ctx.rotate(rad)
          ctx.translate(distance - distances[i], 0)
          ctx.fillText(text, 0, 0)

          ctx.restore()
        })
      }
    })

    this.imageBitmap = canvas.transferToImageBitmap()
  }
}

export default LineLayer
