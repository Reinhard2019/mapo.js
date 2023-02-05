import { clamp, debounce, floor } from 'lodash-es'
import * as THREE from 'three'
import { BBox, LngLat } from './types'
import { getDisplayCentralAngle, lngLatToVector3, sphericalToLngLat } from './utils/map'
import { degToRad, radToDeg, getQuadraticEquationRes } from './utils/math'

export interface EarthOrbitControlsOptions {
  domElement?: HTMLElement
  earthRadius: number
  lngLat?: LngLat
  zoom?: number
  hash?: boolean
}

class EarthOrbitControls extends THREE.EventDispatcher {
  readonly camera: THREE.PerspectiveCamera
  domElement: HTMLElement = document.body
  private readonly earthRadius: number = 6371
  private readonly fov = 60
  private readonly hash: boolean

  tileSize = 512
  lngLat: LngLat = [0, 0]
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

  constructor (options: EarthOrbitControlsOptions) {
    super()

    if (options.domElement) this.domElement = options.domElement
    if (options.lngLat) this.lngLat = options.lngLat
    this.earthRadius = options.earthRadius
    this.zoom = options.zoom ?? 2
    this.hash = options.hash ?? false

    const { domElement, distance, lngLat } = this

    const pixelRatio = domElement.clientWidth / domElement.clientHeight
    const camera = new THREE.PerspectiveCamera(
      this.fov,
      pixelRatio,
      0.1,
      this.earthRadius * 10000
    )
    const position = lngLatToVector3(lngLat, distance)
    camera.position.set(position.x, position.y, position.z)
    camera.lookAt(0, 0, 0)
    this.camera = camera

    this.updateHash()

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

  private zoom2distance (zoom: number) {
    const { earthRadius, fov, tileSize, domElement } = this
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

  private distance2zoom (distance: number) {
    const { earthRadius, fov, tileSize, domElement } = this
    const centralAngle = getDisplayCentralAngle(
      distance,
      earthRadius,
      fov
    )
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
    // 每 1 个像素对应的最小纬度
    const pxLat = radToDeg(Math.asin(pxLength / earthRadius))
    const zoom = Math.log2(360 / pxLat / tileSize)
    return zoom
  }

  get distance () {
    return this._distance
  }

  private set distance (value: number) {
    this._distance = value
    this._zoom = this.distance2zoom(value)
  }

  get zoom () {
    return this._zoom
  }

  set zoom (value: number) {
    this._zoom = value
    this._distance = this.zoom2distance(value)
  }

  get z () {
    return Math.ceil(this.zoom)
  }

  get bbox (): BBox {
    const { distance, earthRadius, fov, domElement, lngLat } = this
    // 垂直方向
    const centralYAngle = getDisplayCentralAngle(
      distance,
      earthRadius,
      fov
    )
    const halfCentralYAngle = centralYAngle / 2
    const s = lngLat[1] - halfCentralYAngle
    const n = lngLat[1] + halfCentralYAngle
    // 水平方向
    let centralXAngle = 180
    if (n <= 90 && s >= -90) {
      const fovX = radToDeg(Math.atan(domElement.clientWidth / (domElement.clientHeight / Math.tan(degToRad(fov / 2))))) * 2
      centralXAngle = getDisplayCentralAngle(
        distance,
        earthRadius,
        fovX
      )
    }
    const halfCentralXAngle = centralXAngle / 2
    const w = lngLat[0] - halfCentralXAngle
    const e = lngLat[0] + halfCentralXAngle
    // TODO 四个角加载不全
    return [w, s, e, n]
  }

  private updateHash () {
    const { zoom, lngLat, hash } = this
    if (hash) {
      location.hash = `${floor(zoom, 2)}/${floor(lngLat[0], 3)}/${floor(
        lngLat[1],
        3
        )}`
    }
  }

  private onMousemove (e: MouseEvent) {
    e.preventDefault()

    if (e.buttons === 0) {
      return
    }

    const { camera, domElement } = this

    if (e.ctrlKey) {
      if (Math.abs(e.movementX) > Math.abs(e.movementY)) {
        const movementDeg = e.movementX / domElement.clientWidth * 360
        this.bearing += movementDeg
        console.log(this.bearing, camera)
        camera.rotation.z = degToRad(this.bearing)
      } else {
        // TODO pitch 处理有 bearing 的情况
        const movementDeg = e.movementY / domElement.clientHeight * 180
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
        camera.lookAt(lookAtPosition)
      }
    } else {
      // TODO 增加阻尼效果
      const spherical = new THREE.Spherical().setFromVector3(camera.position)

      const movementYDeg = e.movementX / domElement.clientWidth * 36
      const movementXDeg = e.movementY / domElement.clientHeight * 36
      spherical.theta -= degToRad(movementYDeg) * Math.cos(degToRad(this.bearing)) + degToRad(movementXDeg) * Math.sin(degToRad(this.bearing))
      // TODO 处理小于 0 或者大于 180 的情况
      spherical.phi -= -degToRad(movementYDeg) * Math.sin(degToRad(this.bearing)) + degToRad(movementXDeg) * Math.cos(degToRad(this.bearing))

      const position = new THREE.Vector3().setFromSpherical(spherical)
      camera.position.set(position.x, position.y, position.z)
      camera.lookAt(0, 0, 0)
      camera.rotateZ(degToRad(this.bearing))

      this.lngLat = sphericalToLngLat(spherical)

      this.dispatchEvent({ type: 'move' })
      this.updateHash()
    }
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
    this.updateHash()
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
