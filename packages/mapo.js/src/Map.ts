import * as THREE from 'three'
import type { Event } from 'three'
import {
  AnimationOptions,
  BBox,
  CameraOptions,
  EarthOrbitControlsOptions,
  LngLat,
  MapOptions,
  Point2,
} from './types'
import EarthOrbitControls from './EarthOrbitControls'
import BaseLayer from './layers/BaseLayer'
import { floor, isNil, last, pick, pickBy, remove } from 'lodash-es'
import { unwrapHTMLElement } from './utils/dom'
import {
  getDisplayCentralAngle,
  getTangentFov,
  lngLatToVector3,
  vector3ToLngLat,
} from './utils/map'
import BeforeLayerManager from './layers/BeforeLayerManager'
import BaseBeforeLayer from './layers/BaseBeforeLayer'
import { degToRad, hypotenuse, radToDeg, rectangleIntersect } from './utils/math'
import { bbox, lineIntersect, lineString, polygon } from '@turf/turf'
import { inRange } from './utils/number'
import Control from './Control'
import { Polygon } from 'geojson'
import TileGroup from './TileGroup'
import anime from 'animejs'

interface _Event extends Event {
  type: 'render' | 'zoom' | 'rotate' | 'move' | 'pitch'
}

class Map extends THREE.EventDispatcher<_Event> {
  tileSize = 512
  // 地球半径 6371km
  readonly earthRadius = 6371

  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly hash: boolean = false

  private readonly earthOrbitControls: EarthOrbitControls
  readonly container: HTMLElement

  private readonly beforeLayerManager: BeforeLayerManager
  private readonly tileGroup: TileGroup

  private readonly disposeFuncList: Array<() => void> = []
  private readonly controlArr: Control[] = []

  private _displayPolygon: Polygon
  displayBBox: BBox

  constructor(options: MapOptions) {
    super()

    const container = unwrapHTMLElement(options.container)
    if (!(container instanceof HTMLElement)) {
      console.error('can not find container')
      return
    }
    container.style.position = 'relative'
    this.container = container

    if (typeof options.hash === 'boolean') this.hash = options.hash
    this.renderer = new THREE.WebGLRenderer(options.webGLRendererParameters)

    const pixelRatio = container.clientWidth / container.clientHeight
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(pixelRatio)
    if (!options.ssr) container.appendChild(this.renderer.domElement)
    this.disposeFuncList.push(() => this.renderer.dispose())

    this.scene.background = new THREE.Color(0x020924)
    // this.scene.fog = new THREE.Fog(0x020924, 200, 1000)

    // this.addBackground()

    // 镜头控制器
    const hashOptions = this.parseHash()
    this.earthOrbitControls = new EarthOrbitControls({
      domElement: container,
      earthRadius: this.earthRadius,
      center: options.center,
      zoom: options.zoom,
      bearing: options.bearing,
      pitch: options.pitch,
      ...hashOptions,
    })
    this.initEarthOrbitControls()

    this.updateHash()

    this.beforeLayerManager = new BeforeLayerManager({
      container,
      map: this,
      earthOrbitControls: this.earthOrbitControls,
    })

    // 页面重绘动画
    const tick = () => {
      // 更新渲染器
      this.renderer.render(this.scene, this.earthOrbitControls.camera)
      // 页面重绘时调用自身
      const id = window.requestAnimationFrame(tick)
      this.disposeFuncList.push(() => window.cancelAnimationFrame(id))

      this.dispatchEvent({ type: 'render' })
    }
    tick()

    // getDisplayPolygon 中有调用 project，project 方法必须在 render 后面
    this.displayPolygon = this.getDisplayPolygon()

    this.tileGroup = new TileGroup({
      map: this,
      earthOrbitControls: this.earthOrbitControls,
    })
    this.scene.add(this.tileGroup)
    this.disposeFuncList.push(() => this.tileGroup.dispose())

    if (!options.ssr) {
      const ro = new ResizeObserver(() => {
        const _pixelRatio = container.clientWidth / container.clientHeight

        this.renderer.setPixelRatio(_pixelRatio)
        this.renderer.setSize(container.clientWidth, container.clientHeight)

        const { camera } = this.earthOrbitControls
        camera.aspect = _pixelRatio
        camera.updateProjectionMatrix()

        this.beforeLayerManager.refresh()
      })
      ro.observe(container)
      this.disposeFuncList.push(() => ro.disconnect())
    }
  }

  addBackground() {
    const { earthRadius } = this
    // 因为是球体，需要将图片横向和竖向各翻转一次，让图片边界可以正常衔接
    const reverseRepeat = 2
    const heightSegments = reverseRepeat * 100
    const widthSegments = heightSegments
    const widthPositionCount = widthSegments + 1
    const heightPositionCount = heightSegments + 1

    const backgroundGeometry = new THREE.SphereGeometry(
      earthRadius * 1000,
      widthSegments,
      heightSegments,
    )

    const uv: number[] = []
    for (let y = 0; y < heightPositionCount; y++) {
      for (let x = 0; x < widthPositionCount; x++) {
        const xUv = ((x * reverseRepeat) / widthSegments) % reverseRepeat
        const yUv = ((y * reverseRepeat) / heightSegments) % reverseRepeat
        const uvFormat = (value: number) => {
          if (value > 1) {
            value = reverseRepeat - value
          }
          return value
        }
        uv.push(uvFormat(xUv), uvFormat(yUv))
      }
    }
    backgroundGeometry.attributes.uv = new THREE.Float32BufferAttribute(new Float32Array(uv), 2)

    const texture = new THREE.TextureLoader().load('.//01-earth-splash-stars-ltr.webp')
    texture.minFilter = THREE.NearestFilter
    const backgroundMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    })

    const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial)
    this.scene.add(background)
  }

  get displayPolygon() {
    return this._displayPolygon
  }

  set displayPolygon(value: Polygon) {
    this._displayPolygon = value
    this.displayBBox = bbox(value) as BBox
  }

  private initEarthOrbitControls() {
    const onMove = () => {
      // camera move、rotate、zoom、pitch 时，需要立刻调用 render，以避免 new THREE.Vector3.project(camera) 方法返回错误的结果
      this.renderer.render(this.scene, this.earthOrbitControls.camera)

      this.updateHash()
      this.beforeLayerManager.refresh()

      this.displayPolygon = this.getDisplayPolygon()

      this.tileGroup.update()
    }
    this.earthOrbitControls.addEventListener('move', () => {
      this.dispatchEvent({ type: 'move' })
      onMove()
    })
    this.earthOrbitControls.addEventListener('rotate', () => {
      this.dispatchEvent({ type: 'rotate' })
      onMove()
    })
    this.earthOrbitControls.addEventListener('zoom', () => {
      this.dispatchEvent({ type: 'zoom' })
      onMove()
    })
    this.earthOrbitControls.addEventListener('pitch', () => {
      this.dispatchEvent({ type: 'pitch' })
      onMove()
    })
  }

  private parseHash():
    | Pick<EarthOrbitControlsOptions, 'zoom' | 'center' | 'bearing' | 'pitch'>
    | undefined {
    if (this.hash && location.hash.startsWith('#')) {
      const [zoom, lng, lat, bearing, pitch] = location.hash.slice(1).split('/')
      return {
        zoom: parseFloat(zoom),
        center: [parseFloat(lng), parseFloat(lat)],
        bearing: parseFloat(bearing),
        pitch: parseFloat(pitch),
      }
    }
  }

  private updateHash() {
    if (this.hash) {
      const { zoom, center, bearing, pitch } = this.earthOrbitControls
      const arr = [
        floor(zoom, 2),
        floor(center[0], 3),
        floor(center[1], 3),
        floor(bearing, 2),
        floor(pitch, 2),
      ]
      history.replaceState(null, '', `#${arr.join('/')}`)
    }
  }

  private inContainerRange(point: Point2) {
    const [x, y] = point
    return (
      inRange(x, 0, this.container.clientWidth, '[]') &&
      inRange(y, 0, this.container.clientHeight, '[]')
    )
  }

  /**
   * 将 LngLat 转化为像素位置
   * @param lngLat
   * @param options.allowNotVisible
   * @returns
   */
  project(lngLat: LngLat, options?: { allowNotVisible?: Boolean }): Point2 | null {
    const { camera } = this.earthOrbitControls
    const position = lngLatToVector3(lngLat, this.earthRadius)
    const vector = position.clone().project(camera)
    const w = this.container.clientWidth / 2
    const h = this.container.clientHeight / 2
    const x = vector.x * w + w
    const y = -vector.y * h + h

    if (!options?.allowNotVisible) {
      if (!this.inContainerRange([x, y])) {
        return null
      }

      const ray = new THREE.Ray(camera.position, position.clone().sub(camera.position).normalize())
      const chordCenter = new THREE.Vector3()
      ray.closestPointToPoint(new THREE.Vector3(0, 0, 0), chordCenter)
      // 根据弦心和镜头的距离和经纬度和镜头距离的远近来判断经纬度是否被遮挡
      if (
        camera.position.distanceToSquared(chordCenter) < camera.position.distanceToSquared(position)
      ) {
        return null
      }
    }

    return [x, y]
  }

  /**
   * 将像素位置转化为 LngLat
   * 为什么不使用 THREE.Raycaster: https://github.com/mrdoob/three.js/issues/11449
   * @param point
   * @param options.allowFovLimitExceeded 是否允许该点对应的视角超出球体相切角度，如果为 true，即便超出相切角度，也会将其转化为相切角度然后返回经纬度
   * @returns
   */
  unproject(point: Point2, options?: { allowFovLimitExceeded?: boolean }): LngLat | null {
    if (!this.inContainerRange(point)) {
      return null
    }

    // 将像素位置转化为以 container 中心点为原点的 xy 轴坐标
    const x = point[0] - this.container.clientWidth / 2
    const y = -(point[1] - this.container.clientHeight / 2)

    const diagonal = hypotenuse(x, y) * 2
    const tangentFov = getTangentFov(this.earthOrbitControls.distance, this.earthRadius)
    const fov = this.earthOrbitControls.getFov(diagonal)
    if (!options?.allowFovLimitExceeded && fov > tangentFov) {
      return null
    }
    const centralAngle = getDisplayCentralAngle(
      this.earthOrbitControls.distance,
      this.earthRadius,
      fov,
    )

    const aspect = x / y
    let deg = Number.isNaN(aspect) ? 0 : radToDeg(Math.atan(Math.abs(x / y)))
    if (x <= 0 && y < 0) {
      deg = 180 - deg
    } else if (x > 0 && y <= 0) {
      deg = 180 + deg
    } else if (x > 0 && y > 0) {
      deg = 360 - deg
    }

    const xAxis = new THREE.Vector3(-1, 0, 0).applyEuler(
      new THREE.Euler(0, degToRad(this.earthOrbitControls.center[0])),
    )
    const vector3 = lngLatToVector3(this.earthOrbitControls.center, this.earthRadius)
      .applyAxisAngle(xAxis, degToRad(centralAngle / 2))
      .applyAxisAngle(
        lngLatToVector3(this.earthOrbitControls.center, 1),
        degToRad(deg - this.earthOrbitControls.bearing),
      )
    return vector3ToLngLat(vector3)
  }

  private getDisplayPolygon() {
    let bearing = this.earthOrbitControls.bearing
    bearing %= 180
    bearing = bearing >= 0 ? bearing : 180 + bearing
    const diagonalDeg = radToDeg(Math.atan(this.earthOrbitControls.camera.aspect))
    let arr = [0, diagonalDeg, 90, 180 - diagonalDeg]
    const removeWhenEqBearing = (i: number) => {
      if (Math.round(arr[i]) === Math.round(bearing)) {
        arr.splice(i, 1)
      }
    }
    for (let i = 1; i < arr.length; i++) {
      if (bearing < arr[i]) {
        arr.splice(i, 0, bearing)
        removeWhenEqBearing(i - 1)
        removeWhenEqBearing(i + 1)
        break
      }
      if (i === arr.length - 1) {
        arr.push(bearing)
        removeWhenEqBearing(i)
        removeWhenEqBearing(0)
        break
      }
    }
    arr = [...arr, ...arr.map(v => v + 180)]
    let bearingIndex = arr.findIndex(v => v === bearing)
    if (this.earthOrbitControls.bearing < 0) {
      bearingIndex += arr.length / 2
    }
    arr = [...arr.slice(bearingIndex), ...arr.slice(0, bearingIndex)]

    let lngLatArr = arr
      .map(v =>
        rectangleIntersect(this.container.clientWidth, this.container.clientHeight, 360 - v),
      )
      .map((point: Point2) => this.unproject(point, { allowFovLimitExceeded: true })!)

    const sortLngLatArr = () => {
      const spliceIndex = lngLatArr
        .slice(0, -1)
        .findIndex((v, i) => v[0] > 0 && lngLatArr[i + 1][0] < 0)
      if (spliceIndex !== -1)
        lngLatArr = [...lngLatArr.slice(spliceIndex + 1), ...lngLatArr.slice(0, spliceIndex + 1)]
    }
    const getIntersectLat = () => {
      const start = last(lngLatArr)!
      const end = [...lngLatArr[0]]
      end[0] += 360
      const featureCollection = lineIntersect(
        lineString([start, end]),
        lineString([
          [180, -90],
          [180, 90],
        ]),
      )
      return featureCollection.features[0]?.geometry?.coordinates?.[1]
    }

    const northPoleVisible = !!this.project([0, 90])
    const southPoleVisible = !!this.project([0, -90])
    if (southPoleVisible) {
      lngLatArr.reverse()
    }
    if (northPoleVisible || southPoleVisible) {
      sortLngLatArr()
      if (lngLatArr[0][0] === -180) {
        lngLatArr.push([180, lngLatArr[0][1]])
      } else if (last(lngLatArr)![0] === 180) {
        lngLatArr.unshift([-180, last(lngLatArr)![1]])
      } else {
        const intersectLat = getIntersectLat()
        lngLatArr.unshift([-180, intersectLat])
        lngLatArr.push([180, intersectLat])
      }
      const topLat = northPoleVisible ? 90 : -90
      lngLatArr.unshift([-180, topLat])
      lngLatArr.push([180, topLat])

      return polygon([[...lngLatArr, lngLatArr[0]]]).geometry
    }

    const halfLength = lngLatArr.length / 2
    lngLatArr[0][0] = lngLatArr[halfLength][0] = this.earthOrbitControls.center[0]
    lngLatArr.slice(1, halfLength).forEach(v => {
      if (v[0] > this.earthOrbitControls.center[0]) {
        v[0] -= 360
      }
    })
    lngLatArr.slice(halfLength + 1).forEach(v => {
      if (v[0] < this.earthOrbitControls.center[0]) {
        v[0] += 360
      }
    })

    return polygon([[...lngLatArr, lngLatArr[0]]]).geometry
  }

  addLayer(layer: BaseLayer | BaseBeforeLayer) {
    if (layer instanceof BaseBeforeLayer) {
      this.beforeLayerManager.addLayer(layer)
    } else {
      this.tileGroup.tileMaterials.layerManager.addLayer(layer)
    }
  }

  removeLayer(layer: BaseLayer | BaseBeforeLayer) {
    if (layer instanceof BaseBeforeLayer) {
      this.beforeLayerManager.removeLayer(layer)
    } else {
      this.tileGroup.tileMaterials.layerManager.removeLayer(layer)
    }
  }

  addControl(control: Control) {
    if (!this.controlArr.find(v => v === control)) {
      control.onAdd(this)
      this.controlArr.push(control)
    }
  }

  removeControl(control: Control) {
    control.onRemove(this)
    remove(this.controlArr, v => v === control)
  }

  flyTo(options: CameraOptions & AnimationOptions) {
    const targetsTransformer = (cameraOptions: CameraOptions) => {
      const [lng, lat] = cameraOptions.center ?? []
      return pickBy(
        {
          lng,
          lat,
          zoom: cameraOptions.zoom,
          bearing: cameraOptions.bearing,
          pitch: cameraOptions.pitch,
        },
        v => !isNil(v),
      )
    }
    const animationOptions = pick(options, ['duration'])

    const targets = targetsTransformer(this.earthOrbitControls)

    anime({
      targets,
      ...targetsTransformer(options),
      duration: 300,
      easing: 'linear',
      ...animationOptions,
      update: () => {
        !isNil(options.center) && this.setCenter([targets.lng!, targets.lat!])
        !isNil(options.zoom) && this.setZoom(targets.zoom!)
        !isNil(options.bearing) && this.setZoom(targets.bearing!)
        !isNil(options.pitch) && this.setZoom(targets.pitch!)
      },
    })
  }

  getCenter() {
    return this.earthOrbitControls.center
  }

  setCenter(value: LngLat) {
    this.earthOrbitControls.setCenter(value)
  }

  getZoom() {
    return this.earthOrbitControls.zoom
  }

  setZoom(value: number) {
    this.earthOrbitControls.setZoom(value)
  }

  getBearing() {
    return this.earthOrbitControls.bearing
  }

  setBearing(value: number) {
    this.earthOrbitControls.setBearing(value)
  }

  setPitch(value: number) {
    this.earthOrbitControls.setPitch(value)
  }

  private clearContainer() {
    Array.from(this.container.childNodes).forEach(child => {
      this.container.removeChild(child)
    })
  }

  dispose() {
    this.disposeFuncList.forEach(func => func())

    this.controlArr.forEach(control => control.onRemove(this))

    this.clearContainer()
  }
}

export default Map
