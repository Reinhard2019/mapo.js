import { clamp, debounce } from 'lodash-es'
import * as THREE from 'three'
import { EarthOrbitControlsOptions, LngLat } from './types'
import { getDisplayCentralAngle, lngLatToVector3, normalizeLng } from './utils/map'
import { degToRad, radToDeg, getQuadraticEquationRes } from './utils/math'

class EarthOrbitControls extends THREE.EventDispatcher {
  readonly camera: THREE.PerspectiveCamera
  domElement: HTMLElement = document.body
  private readonly earthRadius: number = 6371
  /**
   * 垂直方向的视角
   */
  private readonly fov = 60

  tileSize = 512
  center: LngLat = [0, 0]
  private _distance = 0
  private _zoom = 0

  bearing = 0
  pitch = 0
  // enablePitch = true

  minDistance = this.earthRadius + 0.2
  maxDistance = this.earthRadius * 4

  private disposeFuncList: Array<() => void> = []
  private readonly onEnd = debounce(function () {
    this.dispatchEvent({ type: 'end' })
  }, 250)

  constructor(options: EarthOrbitControlsOptions) {
    super()

    if (options.domElement) this.domElement = options.domElement
    if (options.center) this.center = options.center
    this.earthRadius = options.earthRadius
    this.zoom = options.zoom ?? 2
    if (options.bearing) this.bearing = options.bearing

    const { domElement, distance, center } = this

    const pixelRatio = domElement.clientWidth / domElement.clientHeight
    const camera = new THREE.PerspectiveCamera(this.fov, pixelRatio, 0.1, this.earthRadius * 10000)
    this.camera = camera
    camera.position.copy(lngLatToVector3(center, distance))
    this.lookAt()

    const eventListenerList: Array<[keyof HTMLElementEventMap, EventListener]> = [
      ['mousemove', this.onMousemove.bind(this)],
      ['contextmenu', this.onContextmenu.bind(this)],
      ['wheel', this.onMousewheel.bind(this)],
      ['pointerup', this.onPointerup.bind(this)],
    ]
    eventListenerList.forEach(([type, listener]) => {
      this.domElement.addEventListener(type, listener)
      this.disposeFuncList.push(() => this.domElement.removeEventListener(type, listener))
    })
  }

  private getDistance() {
    const { earthRadius, fov, tileSize, zoom, domElement } = this
    const pxLat = 360 / (Math.pow(2, zoom) * tileSize)
    const pxLength = Math.sin(degToRad(pxLat)) * earthRadius
    const chordLength = pxLength * domElement.clientHeight
    // 摄像头到弦心的距离
    const distanceFromTheCameraToTheChord = chordLength / 2 / Math.tan(degToRad(fov / 2))

    // x^{2} + distanceFromTheCameraToTheChord * x - earthRadius^{2}
    const a = 1
    const b = distanceFromTheCameraToTheChord
    const c = -Math.pow(earthRadius, 2)
    // 弦心到圆心的距离
    const distanceFromTheChordToTheCentre = Math.max(...getQuadraticEquationRes(a, b, c))
    const distance = distanceFromTheCameraToTheChord + distanceFromTheChordToTheCentre
    return distance
  }

  private getZoom() {
    const { tileSize } = this
    const zoom = Math.log2(360 / this.getPxDeg() / tileSize)
    return zoom
  }

  /**
   * 每 1 个像素对应的最小度数
   */
  getPxDeg() {
    const { earthRadius, fov, distance, domElement } = this
    const centralAngle = getDisplayCentralAngle(distance, earthRadius, fov)
    // 弦心到圆心的距离
    const distanceFromTheChordToTheCentre = Math.cos(degToRad(centralAngle / 2)) * earthRadius
    // 摄像头到弦心的距离
    const distanceFromTheCameraToTheChord = distance - distanceFromTheChordToTheCentre
    // 弦长
    const chordLength = Math.tan(degToRad(fov / 2)) * distanceFromTheCameraToTheChord * 2
    // 每 1 个像素对应的弦长
    const pxLength = chordLength / domElement.clientHeight
    const pxDeg = radToDeg(Math.asin(pxLength / earthRadius))
    return pxDeg
  }

  get distance() {
    return this._distance
  }

  private set distance(value: number) {
    this._distance = value
    this._zoom = this.getZoom()
  }

  get zoom() {
    return this._zoom
  }

  private set zoom(value: number) {
    this._zoom = value
    this._distance = this.getDistance()
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
    // 邻边
    const adjacent = this.domElement.clientHeight / Math.tan(degToRad(this.fov / 2))
    return radToDeg(Math.atan(diagonal / adjacent)) * 2
  }

  private lookAt() {
    this.camera.lookAt(new THREE.Vector3(0, 0, 0))
    this.camera.rotateZ(-degToRad(this.bearing))
    this.camera.rotateX(degToRad(this.pitch))
  }

  private onMousemove(e: MouseEvent) {
    e.preventDefault()

    if (e.buttons === 0) {
      return
    }

    const { camera, domElement } = this

    const isMove = !e.ctrlKey
    if (isMove) {
      // TODO 增加阻尼效果
      const movementXDeg = -(e.movementX / domElement.clientWidth) * 36
      const movementYDeg = (e.movementY / domElement.clientHeight) * 36
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

      this.dispatchEvent({ type: 'move' })
      return
    }

    const isRotate = Math.abs(e.movementX) > Math.abs(e.movementY)
    if (isRotate) {
      const movementDeg = (e.movementX / domElement.clientWidth) * 360
      this.bearing -= movementDeg
      this.lookAt()

      this.dispatchEvent({ type: 'rotate' })
      return
    }

    const movementDeg = (e.movementY / domElement.clientHeight) * 180
    this.pitch = clamp(this.pitch + movementDeg, 0, 85)
    this.lookAt()
  }

  private onContextmenu(e: PointerEvent) {
    e.preventDefault()
  }

  private onMousewheel(e: WheelEvent) {
    e.preventDefault()
    e.stopPropagation()

    const spherical = new THREE.Spherical().setFromVector3(this.camera.position)
    const movement = 1000 / Math.pow(2, this.zoom)
    if (e.deltaY > 0) {
      spherical.radius = Math.min(spherical.radius + movement, this.maxDistance)
    } else {
      spherical.radius = Math.max(spherical.radius - movement, this.minDistance)
    }
    const vector3 = new THREE.Vector3().setFromSpherical(spherical)
    this.camera.position.x = vector3.x
    this.camera.position.y = vector3.y
    this.camera.position.z = vector3.z

    this.distance = spherical.radius

    this.dispatchEvent({ type: 'zoom' })
    this.onEnd()
  }

  private onPointerup(e: PointerEvent) {
    e.preventDefault()

    this.dispatchEvent({ type: 'end' })
  }

  setCenter(value: LngLat) {
    this.center = value

    this.camera.position.copy(lngLatToVector3(this.center, this.distance))
    this.lookAt()

    this.dispatchEvent({ type: 'move' })
  }

  setZoom(value: number) {
    this.zoom = value

    this.camera.position.copy(lngLatToVector3(this.center, this.distance))

    this.dispatchEvent({ type: 'zoom' })
  }

  setBearing(value: number) {
    this.bearing = value

    this.lookAt()

    this.dispatchEvent({ type: 'rotate' })
  }

  dispose() {
    this.disposeFuncList.forEach(func => func())
    this.disposeFuncList = []
  }
}

export default EarthOrbitControls
