import { clamp, clone, debounce, isNumber } from 'lodash-es'
import * as THREE from 'three'
import { CameraEvent, EarthOrbitControlsOptions, LngLat } from './types'
import { lngLatToVector3, normalizeLng } from './utils/map'
import { degToRad, radToDeg } from './utils/math'

class EarthOrbitControls extends THREE.EventDispatcher<CameraEvent> {
  readonly camera: THREE.PerspectiveCamera
  domElement: HTMLElement = document.body
  private readonly earthRadius: number = 6371
  /**
   * 垂直方向的视角
   */
  readonly fov = 60

  tileSize = 512
  center: LngLat = [0, 0]
  private _distance = 0
  private _zoom = 0

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

    if (options.domElement) this.domElement = options.domElement
    if (Array.isArray(options.center)) this.center = clone(options.center)
    this.earthRadius = options.earthRadius
    this.zoom = options.zoom ?? 2
    if (isNumber(options.bearing)) this.bearing = options.bearing
    if (isNumber(options.pitch)) this.pitch = options.pitch

    const pixelRatio = this.domElement.clientWidth / this.domElement.clientHeight
    const camera = new THREE.PerspectiveCamera(this.fov, pixelRatio, 0.1, this.earthRadius * 10000)
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

  zoomToDistance(zoom: number) {
    const { earthRadius, fov, domElement } = this
    const pxDeg = this.getPxDeg(zoom)
    const pxTangentLength = Math.tan(degToRad(pxDeg)) * earthRadius
    const tangentLength = pxTangentLength * domElement.clientHeight
    const distanceFromTheCameraToTheEarth = tangentLength / 2 / Math.tan(degToRad(fov / 2))
    return distanceFromTheCameraToTheEarth + earthRadius
  }

  distanceToZoom(distance: number) {
    const { tileSize, earthRadius, fov } = this
    const distanceFromTheCameraToTheEarth = distance - earthRadius
    const tangentLength = distanceFromTheCameraToTheEarth * Math.tan(degToRad(fov / 2)) * 2
    const pxTangentLength = tangentLength / this.domElement.clientHeight
    const pxDeg = radToDeg(Math.atan(pxTangentLength / earthRadius))
    const zoom = Math.log2(360 / pxDeg / tileSize)
    return zoom
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
    return 360 / (Math.pow(2, zoom) * this.tileSize)
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
    this.updateCameraPosition()
  }

  get zoom() {
    return this._zoom
  }

  private set zoom(value: number) {
    this._zoom = value
    this._distance = this.zoomToDistance(value)
  }

  get z() {
    return Math.ceil(this.zoom)
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

    const { camera, domElement } = this

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
      camera.position.copy(lngLatToVector3(this.center, this.distance))
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

  private onMousewheel(e: WheelEvent) {
    e.preventDefault()
    e.stopPropagation()

    this.zoom = this.zoom - e.deltaY / 100
    this.updateCameraPosition()

    this.onZoomStart()
    this.dispatchEvent({ type: 'zoom' })
    this.onZoomEnd()
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
