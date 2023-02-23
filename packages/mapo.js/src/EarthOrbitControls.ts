import { clamp, debounce } from 'lodash-es'
import * as THREE from 'three'
import { BBox, EarthOrbitControlsOptions, LngLat } from './types'
import { latPretreatmentBBox } from './utils/bbox'
import { getDisplayCentralAngle, lngLatToVector3, vector3ToLngLat } from './utils/map'
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

  private lookAtPosition = new THREE.Vector3(0, 0, 0)

  private disposeFuncList: Array<() => void> = []
  private readonly onEnd = debounce(function () {
    this.dispatchEvent({ type: 'end' })
  }, 250)

  constructor (options: EarthOrbitControlsOptions) {
    super()

    if (options.domElement) this.domElement = options.domElement
    if (options.center) this.center = options.center
    this.earthRadius = options.earthRadius
    this.zoom = options.zoom ?? 2
    if (options.bearing) this.bearing = options.bearing

    const { domElement, distance, center } = this

    const pixelRatio = domElement.clientWidth / domElement.clientHeight
    const camera = new THREE.PerspectiveCamera(this.fov, pixelRatio, 0.1, this.earthRadius * 10000)
    camera.position.copy(lngLatToVector3(center, distance))
    this.camera = camera
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

  private getDistance () {
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

  private getZoom () {
    const { tileSize } = this
    const zoom = Math.log2(360 / this.getPxDeg() / tileSize)
    return zoom
  }

  /**
   * 每 1 个像素对应的最小度数
   */
  getPxDeg () {
    const { earthRadius, fov, distance, domElement } = this
    const centralAngle = getDisplayCentralAngle(distance, earthRadius, fov)
    // 弦心到圆心的距离
    const distanceFromTheChordToTheCentre = Math.cos(degToRad(centralAngle / 2)) * earthRadius
    // 摄像头到弦心的距离
    const distanceFromTheCameraToTheChord = distance - distanceFromTheChordToTheCentre
    /**
     * 弦长
     * ![avatar](./assets/extendChordLength.svg)
     */
    const chordLength = Math.tan(degToRad(fov / 2)) * distanceFromTheCameraToTheChord * 2
    // 每 1 个像素对应的弦长
    const pxLength = chordLength / domElement.clientHeight
    const pxDeg = radToDeg(Math.asin(pxLength / earthRadius))
    return pxDeg
  }

  get distance () {
    return this._distance
  }

  private set distance (value: number) {
    this._distance = value
    this._zoom = this.getZoom()
  }

  get zoom () {
    return this._zoom
  }

  set zoom (value: number) {
    this._zoom = value
    this._distance = this.getDistance()
  }

  get z () {
    return Math.ceil(this.zoom)
  }

  /**
   * 水平方向的视角
   */
  get fovX () {
    const adjacent = this.domElement.clientHeight / Math.tan(degToRad(this.fov / 2))
    return radToDeg(Math.atan(this.domElement.clientWidth / adjacent)) * 2
  }

  /**
   * 获取未经处理的显示区域
   * @returns
   */
  getPlainDisplayBBox (): BBox {
    const { distance, earthRadius, fov, center } = this

    // 垂直方向
    const centralYAngle = getDisplayCentralAngle(distance, earthRadius, fov)
    const halfCentralYAngle = centralYAngle / 2
    const s = center[1] - halfCentralYAngle
    const n = center[1] + halfCentralYAngle

    // 水平方向
    const centralXAngle = getDisplayCentralAngle(distance, earthRadius, this.fovX)
    const halfCentralXAngle = centralXAngle / 2
    const w = center[0] - halfCentralXAngle
    const e = center[0] + halfCentralXAngle

    // TODO 四个角加载不全
    return [w, s, e, n]
  }

  getDisplayBBox (): BBox {
    return latPretreatmentBBox(this.getPlainDisplayBBox())
  }

  private lookAt () {
    this.camera.lookAt(this.lookAtPosition)
    this.camera.rotateZ(-degToRad(this.bearing))
  }

  private onMousemove (e: MouseEvent) {
    e.preventDefault()

    if (e.buttons === 0) {
      return
    }

    const { camera, domElement } = this

    const isMove = !e.ctrlKey
    if (isMove) {
      // TODO 增加阻尼效果
      const movementLng = (e.movementX / domElement.clientWidth) * 36
      const movementLat = (e.movementY / domElement.clientHeight) * 36
      camera.position.applyAxisAngle(
        new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion),
        -degToRad(movementLng),
      )
      const applyXAxisAngle = (vector3: THREE.Vector3) =>
        vector3.applyAxisAngle(
          new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
          -degToRad(movementLat),
        )
      applyXAxisAngle(camera.position)
      applyXAxisAngle(camera.up)
      this.lookAt()
      // TODO 移动时 bearing 也会改变

      this.center = vector3ToLngLat(camera.position)

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

    // TODO pitch 处理有 bearing 的情况
    const movementDeg = (e.movementY / domElement.clientHeight) * 180
    this.pitch = clamp(this.pitch + movementDeg, 0, 85)
    const negativePosition = camera.position.clone()
    negativePosition.x = -negativePosition.x
    negativePosition.y = -negativePosition.y
    negativePosition.z = -negativePosition.z
    const spherical = new THREE.Spherical().setFromVector3(negativePosition)
    spherical.phi -= degToRad(this.pitch)
    const lookAtPosition = new THREE.Vector3().setFromSpherical(spherical)
    lookAtPosition.x -= negativePosition.x
    lookAtPosition.y -= negativePosition.y
    lookAtPosition.z -= negativePosition.z
    this.lookAtPosition = lookAtPosition
    this.lookAt()
  }

  private onContextmenu (e: PointerEvent) {
    e.preventDefault()
  }

  private onMousewheel (e: WheelEvent) {
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

  private onPointerup (e: PointerEvent) {
    e.preventDefault()

    this.dispatchEvent({ type: 'end' })
  }

  dispose () {
    this.disposeFuncList.forEach(func => func())
    this.disposeFuncList = []
  }
}

export default EarthOrbitControls
