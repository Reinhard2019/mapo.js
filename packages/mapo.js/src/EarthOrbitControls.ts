import { clamp, clone, debounce, isNumber } from 'lodash-es'
import * as THREE from 'three'
import { CameraEvent, EarthOrbitControlsOptions, LngLat } from './types'
import Map from './Map'
import { lngLatToVector3, normalizeLng, vector3ToLngLat } from './utils/map'
import { degToRad, radToDeg } from './utils/math'

class EarthOrbitControls extends THREE.EventDispatcher<CameraEvent> {
  readonly camera: THREE.PerspectiveCamera
  private readonly map: Map
  private readonly domElement: HTMLElement
  /**
   * 垂直方向的视角
   */
  readonly fov = 60

  center: LngLat = [0, 0]
  private _distance = 0
  private _zoom = 0
  minZoom = 1

  private _bearing = 0
  pitch = 0

  private moving = false
  private zooming = false
  private rotating = false
  private pitching = false

  readonly onMoveEnd = debounce(function () {
    const _self = this as EarthOrbitControls
    _self.dispatchEvent({ type: 'moveend' })
    _self.moving = false
  }, 250)

  readonly onZoomEnd = debounce(function () {
    const _self = this as EarthOrbitControls
    _self.dispatchEvent({ type: 'zoomend' })
    _self.zooming = false
  }, 250)

  readonly onRotateEnd = debounce(function () {
    const _self = this as EarthOrbitControls
    _self.dispatchEvent({ type: 'rotateend' })
    _self.rotating = false
  }, 250)

  readonly onPitchEnd = debounce(function () {
    const _self = this as EarthOrbitControls
    _self.dispatchEvent({ type: 'pitchend' })
    _self.pitching = false
  }, 250)

  private disposeFuncList: Array<() => void> = []

  constructor(options: EarthOrbitControlsOptions) {
    super()

    this.map = options.map
    if (options.domElement) this.domElement = options.domElement
    if (Array.isArray(options.center)) this.center = clone(options.center)
    this.zoom = options.zoom ?? 2
    if (isNumber(options.bearing)) this.bearing = options.bearing
    if (isNumber(options.pitch)) this.pitch = options.pitch

    const { earthRadius } = this.map

    const pixelRatio = this.domElement.clientWidth / this.domElement.clientHeight
    const camera = new THREE.PerspectiveCamera(this.fov, pixelRatio, 0.1, earthRadius * 10000)
    this.camera = camera
    this.updateCameraPosition()
    this.lookAt()

    const eventListenerList: Array<[keyof HTMLElementEventMap, EventListener]> = [
      ['mousemove', this.onMousemove.bind(this)],
      ['contextmenu', this.onContextmenu.bind(this)],
      ['wheel', this.onMousewheel.bind(this)],
    ]
    eventListenerList.forEach(([type, listener]) => {
      this.domElement.addEventListener(type, listener)
      this.disposeFuncList.push(() => this.domElement.removeEventListener(type, listener))
    })
  }

  /**
   * zoom 转化为 distance
   * @param zoom
   * @returns
   */
  zoomToDistance(zoom: number) {
    const { fov, domElement } = this
    const { earthRadius } = this.map
    const pxDeg = this.getPxDeg(zoom)
    const pxTangentLength = Math.tan(degToRad(pxDeg)) * earthRadius
    const tangentLength = pxTangentLength * domElement.clientHeight
    const distanceFromTheCameraToTheEarth = tangentLength / 2 / Math.tan(degToRad(fov / 2))
    return distanceFromTheCameraToTheEarth + earthRadius
  }

  /**
   * distance 转化为 zoom
   * @param distance
   * @returns
   */
  distanceToZoom(distance: number) {
    const { fov } = this
    const { tileSize, earthRadius } = this.map
    const distanceFromTheCameraToTheEarth = distance - earthRadius
    const tangentLength = distanceFromTheCameraToTheEarth * Math.tan(degToRad(fov / 2)) * 2
    const pxTangentLength = tangentLength / this.domElement.clientHeight
    const pxDeg = radToDeg(Math.atan(pxTangentLength / earthRadius))
    const zoom = Math.log2(360 / pxDeg / tileSize)
    return zoom
  }

  /**
   * 经纬度转化为 zoom
   */
  lngLatToZoom(lngLat: LngLat) {
    const { earthRadius } = this.map
    const distance = this.camera.position.distanceTo(lngLatToVector3(lngLat, earthRadius))
    return this.distanceToZoom(distance + earthRadius)
  }

  isMoving() {
    return this.moving
  }

  isZooming() {
    return this.zooming
  }

  isRotating() {
    return this.rotating
  }

  isPitching() {
    return this.pitching
  }

  /**
   * 每 1 个像素对应的最小度数
   */
  getPxDeg(zoom = this.zoom) {
    const { tileSize } = this.map
    return 360 / (Math.pow(2, zoom) * tileSize)
  }

  private updateCameraPosition() {
    this.camera.position.copy(lngLatToVector3(this.center, this.distance))
  }

  get bearing() {
    return this._bearing
  }

  set bearing(value: number) {
    let newValue = value % 360
    if (newValue > 180) {
      newValue = newValue - 360
    } else if (newValue < -180) {
      newValue = 360 + newValue
    }
    this._bearing = newValue
  }

  get distance() {
    return this._distance
  }

  private set distance(value: number) {
    this._distance = value
    this._zoom = this.distanceToZoom(value)
  }

  get zoom() {
    return this._zoom
  }

  private set zoom(value: number) {
    this._zoom = value
    this._distance = this.zoomToDistance(value)
  }

  /**
   * 根据对角线的像素长度获取对应的视角
   * @param diagonal
   * @returns
   */
  getFov(diagonal: number) {
    // 假设 this.domElement 是一个平面，摄像机是平面外的一个点
    // adjacent 是摄像机到 this.domElement 平面的距离
    const adjacent = this.domElement.clientHeight / 2 / Math.tan(degToRad(this.fov / 2))
    return (radToDeg(Math.atan(diagonal / 2 / adjacent)) + this.pitch) * 2
  }

  private lookAt() {
    this.camera.lookAt(new THREE.Vector3(0, 0, 0))
    this.camera.rotateZ(-degToRad(this.bearing))
    this.camera.rotateX(degToRad(this.pitch))
  }

  onMoveStart() {
    if (!this.moving) {
      this.dispatchEvent({ type: 'movestart' })
    }
    this.moving = true
  }

  onRotateStart() {
    if (!this.rotating) {
      this.dispatchEvent({ type: 'rotatestart' })
    }
    this.rotating = true
  }

  onPitchStart() {
    if (!this.pitching) {
      this.dispatchEvent({ type: 'pitchstart' })
    }
    this.pitching = true
  }

  onZoomStart() {
    if (!this.zooming) {
      this.dispatchEvent({ type: 'zoomstart' })
    }
    this.zooming = true
  }

  private onMousemove(e: MouseEvent) {
    e.preventDefault()

    if (e.buttons === 0) {
      return
    }

    const { domElement } = this

    const isMove = !e.ctrlKey
    if (isMove) {
      const pxDeg = this.getPxDeg()
      // TODO 增加阻尼效果
      const movementXDeg = -(e.movementX * pxDeg)
      const movementYDeg = e.movementY * pxDeg
      this.center[0] +=
        movementXDeg * Math.cos(degToRad(this.bearing)) +
        movementYDeg * Math.sin(degToRad(this.bearing))
      this.center[0] = normalizeLng(this.center[0])
      this.center[1] +=
        -movementXDeg * Math.sin(degToRad(this.bearing)) +
        movementYDeg * Math.cos(degToRad(this.bearing))
      this.center[1] = clamp(this.center[1], -85, 85)
      this.updateCameraPosition()
      this.lookAt()

      this.onMoveStart()
      this.dispatchEvent({ type: 'move' })
      this.onMoveEnd()
      return
    }

    const isRotate = Math.abs(e.movementX) > Math.abs(e.movementY)
    if (isRotate) {
      const movementDeg = (e.movementX / domElement.clientWidth) * 360
      this.bearing -= movementDeg
      this.lookAt()

      this.onRotateStart()
      this.dispatchEvent({ type: 'rotate' })
      this.onRotateEnd()
      return
    }

    const movementDeg = (e.movementY / domElement.clientHeight) * 180
    this.pitch = clamp(this.pitch + movementDeg, 0, 85)
    this.lookAt()

    this.onPitchStart()
    this.dispatchEvent({ type: 'pitch' })
    this.onPitchEnd()
  }

  private onContextmenu(e: PointerEvent) {
    e.preventDefault()
  }

  getCameraAspect() {
    return this.camera.aspect
  }

  setCameraAspect(value: number) {
    this.camera.aspect = value
  }

  getCameraPosition() {
    return this.camera.position.clone()
  }

  /**
   * 获取对应的圆心角
   * @param distance 摄像机到圆心的距离
   * @param fov 摄像机的角度
   * @returns
   */
  getCentralAngle(distance: number, fov: number) {
    const { earthRadius } = this.map
    const tangentFov = Math.asin(earthRadius / distance)
    if (fov >= tangentFov) return Math.PI / 2 - tangentFov

    // 正弦定理
    // 已知三角形两条边 earthRadius、distance，以及一个角 fov(即 earthRadius 边对应的角度)
    // 如果该点位于可视范围内，distanceRad 一定大于 90
    const distanceRad = Math.PI - Math.asin(distance / (earthRadius / Math.sin(fov)))
    return Math.PI - fov - distanceRad
  }

  private onMousewheel(e: WheelEvent) {
    e.preventDefault()
    e.stopPropagation()

    const newZoom = this.zoom - e.deltaY / 100
    if (newZoom < this.minZoom) return

    // TODO 围绕鼠标点缩放，当前的写法存在误差
    const mousePoint = new THREE.Vector2(e.offsetX, e.offsetY)
    const lngLat = this.map.unprojectBoundary(mousePoint)

    const raycaster = this.mousePosition2Raycaster(mousePoint)
    const { position } = this.camera
    const { direction } = raycaster.ray
    const fov = Math.PI - direction.angleTo(position)
    const plane = new THREE.Plane().setFromCoplanarPoints(
      position,
      new THREE.Vector3(0, 0, 0),
      direction,
    )

    // 更新 zoom 和 distance
    this.zoom = newZoom

    const centralAngle = this.getCentralAngle(this.distance, fov)
    this.center = vector3ToLngLat(
      lngLatToVector3(lngLat, 1).applyAxisAngle(plane.normal, centralAngle),
    )

    this.updateCameraPosition()
    this.lookAt()

    this.onZoomStart()
    this.dispatchEvent({ type: 'zoom' })
    this.onZoomEnd()
  }

  /**
   * 将鼠标位置转化为射线
   * @param point
   * @returns
   */
  mousePosition2Raycaster(point: THREE.Vector2) {
    const { camera, domElement } = this

    // 将鼠标位置归一化为设备坐标。x 和 y 方向的取值范围是 (-1 to +1)
    const x = (point.x / domElement.clientWidth) * 2 - 1
    const y = -(point.y / domElement.clientHeight) * 2 + 1

    const raycaster = new THREE.Raycaster()
    // 通过摄像机和鼠标位置更新射线
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera)

    return raycaster
  }

  setCenter(value: LngLat) {
    this.center = clone(value)

    this.updateCameraPosition()
    this.lookAt()

    this.dispatchEvent({ type: 'move' })
  }

  setZoom(value: number) {
    this.zoom = value

    this.updateCameraPosition()

    this.dispatchEvent({ type: 'zoom' })
  }

  setBearing(value: number) {
    this.bearing = value

    this.lookAt()

    this.dispatchEvent({ type: 'rotate' })
  }

  setPitch(value: number) {
    this.pitch = value

    this.lookAt()

    this.dispatchEvent({ type: 'pitch' })
  }

  dispose() {
    this.disposeFuncList.forEach(func => func())
    this.disposeFuncList = []
  }
}

export default EarthOrbitControls
