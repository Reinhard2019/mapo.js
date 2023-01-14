import { clamp, debounce } from 'lodash-es'
import * as THREE from 'three'
import { degToRad, radToDeg } from 'three/src/math/MathUtils'
import { BBox, LngLat } from './types'
import { getDisplayCentralAngle, lngLatToVector3, sphericalToLngLat } from './utils/map'

export interface EarthOrbitControlsOptions {
  domElement?: HTMLElement
  earthRadius: number
  lngLat?: LngLat
}

class EarthOrbitControls extends THREE.EventDispatcher {
  readonly camera: THREE.PerspectiveCamera
  domElement: HTMLElement = document.body
  private readonly earthRadius: number = 6371
  private readonly fov = 60

  tileSize = 512
  lngLat: LngLat = [0, 0]
  private distance = 0

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
    this.distance = this.earthRadius * 3

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

  get zoom () {
    // TODO
    const [w, , e] = this.bbox
    const lngGap = e - w
    const arcLength = degToRad(lngGap) * this.earthRadius
    // 弧长渲染成 2d 后的直线长度
    const arcLength2d = Math.sin(degToRad(lngGap / 2)) * 2 * this.earthRadius
    const width = this.domElement.clientWidth * (arcLength / arcLength2d)
    // 每 1 度对应的像素点
    const ratio = width / lngGap
    const zoom = Math.log2(ratio * 360 / this.tileSize)
    console.log(lngGap, arcLength, arcLength2d, this.domElement.clientWidth, width, zoom)
    return zoom
  }

  get z () {
    return Math.ceil(this.zoom)
  }

  get bbox (): BBox {
    const { distance, earthRadius, fov, domElement, lngLat } = this
    const centralYAngle = getDisplayCentralAngle(
      distance,
      earthRadius,
      fov
    )
    const halfCentralYAngle = centralYAngle / 2
    const fovX = radToDeg(Math.atan(domElement.clientWidth / (domElement.clientHeight / Math.tan(degToRad(fov / 2))))) * 2
    const centralXAngle = getDisplayCentralAngle(
      distance,
      earthRadius,
      fovX
    )
    const halfCentralXAngle = centralXAngle / 2
    // TODO 宽度比高度更大时加载不全
    return [lngLat[0] - halfCentralXAngle, lngLat[1] - halfCentralYAngle, lngLat[0] + halfCentralXAngle, lngLat[1] + halfCentralYAngle]
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
