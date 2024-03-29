import * as THREE from 'three'
import {
  AnimationOptions,
  BBox,
  CameraOptions,
  EarthOrbitControlsOptions,
  LngLat,
  MapEvent,
  MapOptions,
  Point2,
  Terrain,
  TileBoxWithZ,
} from './types'
import EarthOrbitControls from './EarthOrbitControls'
import { floor, isEqual, isNil, last, pick, pickBy, remove } from 'lodash-es'
import { unwrapHTMLElement } from './utils/dom'
import { lngLatToVector3, vector3ToLngLat } from './utils/map'
import { radToDeg, rectangleIntersect } from './utils/math'
import { bbox, lineIntersect, lineString, polygon } from '@turf/turf'
import { inRange } from './utils/number'
import Control from './Control'
import { Polygon } from 'geojson'
import TileGroup from './TileGroup'
import anime from 'animejs'
import PointLayer from './layers/PointLayer'
import PointLayerManager from './layers/PointLayerManager'
import Layer from './layers/Layer'
import CanvasLayer from './layers/CanvasLayer'
import TaskQueue from './utils/TaskQueue'
import MercatorTile from './utils/MercatorTile'
import CanvasLayerManager from './layers/CanvasLayerManager'

class Map extends THREE.EventDispatcher<MapEvent> {
  readonly tileSize = 512
  // 地球半径 6371km
  readonly earthRadius = 6371

  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly hash: boolean = false

  readonly earthOrbitControls: EarthOrbitControls
  readonly container: HTMLElement

  readonly taskQueue = new TaskQueue()

  readonly tileGroup: TileGroup

  readonly canvasLayerManager = new CanvasLayerManager(this)
  private readonly pointLayerManager = new PointLayerManager(this)

  private readonly disposeFuncList: Array<() => void> = []
  private readonly controlArr: Control[] = []

  private displayPolygonUpdate = true
  private displayPolygon: Polygon
  displayBBox: BBox
  displayTileBox: TileBoxWithZ
  displayTileBoxChange = true

  constructor(options: MapOptions) {
    super()

    const container = unwrapHTMLElement(options.container)
    if (!(container instanceof HTMLElement)) {
      console.error('can not find container')
      return
    }
    this.container = container

    const eventListenerList: Array<[keyof HTMLElementEventMap, EventListener]> = [
      ['click', this.onClick.bind(this)],
    ]
    eventListenerList.forEach(([type, listener]) => {
      this.container.addEventListener(type, listener)
      this.disposeFuncList.push(() => this.container.removeEventListener(type, listener))
    })

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
      map: this,
      domElement: container,
      center: options.center,
      zoom: options.zoom,
      bearing: options.bearing,
      pitch: options.pitch,
      ...hashOptions,
    })
    this.initEarthOrbitControls()

    this.updateHash()

    this.tileGroup = new TileGroup({
      map: this,
      terrain: options.terrain,
    })
    this.scene.add(this.tileGroup)
    this.disposeFuncList.push(() => this.tileGroup.dispose())

    // 页面重绘动画
    const render = (time: DOMHighResTimeStamp) => {
      this.earthOrbitControls.camera.updateMatrixWorld()

      this.computeDisplayPolygon()
      this.tileGroup.update()
      this.canvasLayerManager.update()
      this.pointLayerManager.update()
      this.displayTileBoxChange = false

      // 更新渲染器
      this.renderer.render(this.scene, this.earthOrbitControls.camera)

      this.taskQueue.run(time)

      this.dispatchEvent({ type: 'render' })

      // 页面重绘时调用自身
      window.requestAnimationFrame(render)
    }
    render(performance.now())

    if (!options.ssr) {
      this.scene.add(this.pointLayerManager)

      const ro = new ResizeObserver(() => {
        const _pixelRatio = container.clientWidth / container.clientHeight

        this.renderer.setPixelRatio(_pixelRatio)
        this.renderer.setSize(container.clientWidth, container.clientHeight)

        this.earthOrbitControls.setCameraAspect(_pixelRatio)
        this.earthOrbitControls.camera.updateProjectionMatrix()
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

  private initEarthOrbitControls() {
    const onMove = () => {
      this.updateHash()

      this.displayPolygonUpdate = true
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
      const [zoom, lat, lng, bearing, pitch] = location.hash.slice(1).split('/')
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
        floor(center[1], 3),
        floor(center[0], 3),
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

  unprojectBoundary(point: THREE.Vector2) {
    const raycaster = this.earthOrbitControls.mousePosition2Raycaster(point)

    const { earthRadius } = this
    const { distance } = this.earthOrbitControls
    const position = this.earthOrbitControls.getCameraPosition()
    const { direction } = raycaster.ray
    const origin = new THREE.Vector3(0, 0, 0)

    const fov = Math.PI - direction.angleTo(position)
    const tangentFov = Math.asin(earthRadius / distance)
    if (fov >= tangentFov) {
      const centralAngle = Math.PI / 2 - tangentFov
      const plane = new THREE.Plane().setFromCoplanarPoints(position, origin, direction)
      return vector3ToLngLat(position.applyAxisAngle(plane.normal, -centralAngle))
    }

    const centralAngle = this.earthOrbitControls.getCentralAngle(distance, fov)
    // 正弦定理
    const rayDistance = (earthRadius / Math.sin(fov)) * Math.sin(centralAngle)

    const target = new THREE.Vector3()
    raycaster.ray.at(rayDistance, target)
    return vector3ToLngLat(target)
  }

  /**
   * 将像素位置转化为 LngLat
   *
   * https://github.com/mrdoob/three.js/issues/11449
   * @param point
   * @returns
   */
  unproject(point: THREE.Vector2): LngLat | null {
    const raycaster = this.earthOrbitControls.mousePosition2Raycaster(point)

    // 计算物体和射线的焦点
    const intersects = raycaster.intersectObjects(this.tileGroup.children)
    const vector3 = intersects[0]?.point

    return vector3 ? vector3ToLngLat(vector3) : null
  }

  private computeDisplayPolygon() {
    if (!this.displayPolygonUpdate) return
    this.displayPolygonUpdate = false

    this.displayPolygon = this.getDisplayPolygon()
    this.displayBBox = bbox(this.displayPolygon) as BBox

    const z = Math.ceil(this.earthOrbitControls.zoom)
    const displayTileBox = {
      ...MercatorTile.bboxToTileBox(this.displayBBox, z),
      z,
    }
    this.displayTileBoxChange = !isEqual(this.displayTileBox, displayTileBox)
    this.displayTileBox = displayTileBox
  }

  private getDisplayPolygon() {
    let bearing = this.earthOrbitControls.bearing
    bearing %= 180
    bearing = bearing >= 0 ? bearing : 180 + bearing
    const diagonalDeg = radToDeg(Math.atan(this.earthOrbitControls.getCameraAspect()))
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
      .map((point: Point2) => this.unprojectBoundary(new THREE.Vector2(...point)))

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

    const centerLng = this.earthOrbitControls.center[0]
    // 处理可视区域经度横跨180°的情况
    lngLatArr.forEach(lngLat => {
      if (!inRange(lngLat[0] - centerLng, -180, 180, '[]')) {
        lngLat[0] = centerLng > lngLat[0] ? lngLat[0] + 360 : lngLat[0] - 360
      }
    })

    return polygon([[...lngLatArr, lngLatArr[0]]]).geometry
  }

  addLayer(layer: Layer | CanvasLayer) {
    if (layer instanceof PointLayer) {
      this.pointLayerManager.addLayer(layer)
    } else {
      this.canvasLayerManager.addLayer(layer as CanvasLayer)
    }
  }

  removeLayer(layer: Layer | CanvasLayer) {
    if (layer instanceof PointLayer) {
      this.pointLayerManager.removeLayer(layer)
    } else {
      this.canvasLayerManager.removeLayer(layer as CanvasLayer)
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
      begin: () => {
        !isNil(options.center) && this.earthOrbitControls.onMoveStart()
        !isNil(options.zoom) && this.earthOrbitControls.onZoomStart()
        !isNil(options.bearing) && this.earthOrbitControls.onRotateStart()
        !isNil(options.pitch) && this.earthOrbitControls.onPitchStart()
      },
      update: () => {
        !isNil(options.center) && this.setCenter([targets.lng!, targets.lat!])
        !isNil(options.zoom) && this.setZoom(targets.zoom!)
        !isNil(options.bearing) && this.setBearing(targets.bearing!)
        !isNil(options.pitch) && this.setPitch(targets.pitch!)
      },
      complete: () => {
        !isNil(options.center) && this.earthOrbitControls.onMoveEnd()
        !isNil(options.zoom) && this.earthOrbitControls.onZoomEnd()
        !isNil(options.bearing) && this.earthOrbitControls.onRotateEnd()
        !isNil(options.pitch) && this.earthOrbitControls.onPitchEnd()
      },
    })
  }

  getCenter() {
    return this.earthOrbitControls.center
  }

  setCenter(value: LngLat) {
    this.earthOrbitControls.onMoveStart()
    this.earthOrbitControls.setCenter(value)
    this.earthOrbitControls.onMoveEnd()
  }

  getZoom() {
    return this.earthOrbitControls.zoom
  }

  setZoom(value: number) {
    this.earthOrbitControls.onZoomStart()
    this.earthOrbitControls.setZoom(value)
    this.earthOrbitControls.onZoomEnd()
  }

  getBearing() {
    return this.earthOrbitControls.bearing
  }

  setBearing(value: number) {
    this.earthOrbitControls.onRotateStart()
    this.earthOrbitControls.setBearing(value)
    this.earthOrbitControls.onRotateEnd()
  }

  getPitch() {
    return this.earthOrbitControls.pitch
  }

  setPitch(value: number) {
    this.earthOrbitControls.onPitchStart()
    this.earthOrbitControls.setPitch(value)
    this.earthOrbitControls.onPitchEnd()
  }

  setTerrain(terrain: Terrain) {
    this.tileGroup.setTerrain(terrain)
  }

  private clearContainer() {
    Array.from(this.container.childNodes).forEach(child => {
      this.container.removeChild(child)
    })
  }

  private onClick(e) {
    this.dispatchEvent({
      type: 'click',
      lngLat: this.unproject(new THREE.Vector2(e.offsetX, e.offsetY)),
    })
  }

  dispose() {
    this.disposeFuncList.forEach(func => func())

    this.controlArr.forEach(control => control.onRemove(this))

    this.clearContainer()
  }
}

export default Map
