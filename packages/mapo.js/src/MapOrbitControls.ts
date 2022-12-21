import { debounce } from 'lodash-es'
import * as THREE from 'three'
import { degToRad } from 'three/src/math/MathUtils'
import { getZoom } from './utils/map'
import { clamp } from './utils/number'

class MapOrbitControls extends THREE.EventDispatcher {
  object: THREE.PerspectiveCamera
  domElement: HTMLElement = document.body
  earthRadius = 6371

  distance = 0

  bearing = 0
  pitch = 0
  // enablePitch = true

  minDistance = this.earthRadius + 0.2
  maxDistance = this.earthRadius * 4

  private readonly destroyFnList: Array<() => void> = []
  private readonly onEnd = debounce(function () {
    this.dispatchEvent({ type: 'end' })
  }, 250)

  constructor (options: { object: THREE.PerspectiveCamera, domElement?: HTMLElement, earthRadius?: number }) {
    super()

    const { object, domElement, earthRadius } = options
    this.object = object
    if (domElement !== undefined) this.domElement = domElement
    if (earthRadius !== undefined) this.earthRadius = earthRadius

    this.distance = this.getDistance()

    const eventListenerList: Array<[keyof HTMLElementEventMap, EventListener]> = [
      ['mousemove', this.onMousemove],
      ['contextmenu', this.onContextmenu],
      ['wheel', this.onMousewheel],
      ['pointerup', this.onPointerup],
    ]
    eventListenerList.forEach(([type, listener]) => {
      const fn = listener.bind(this)
      this.domElement.addEventListener(type, fn)
      this.destroyFnList.push(() => this.domElement.removeEventListener(type, fn))
    })
  }

  getZoom () {
    return getZoom(this.getDistance(), this.earthRadius, this.object.fov)
  }

  getDistance () {
    const position = this.object.position
    return Math.sqrt(Math.pow(position.x, 2) + Math.pow(position.y, 2) + Math.pow(position.z, 2))
  }

  private onMousemove (e: MouseEvent) {
    e.preventDefault()

    if (e.buttons === 0) {
      return
    }

    const domElement = this.domElement

    if (e.ctrlKey) {
      if (Math.abs(e.movementX) > Math.abs(e.movementY)) {
        const movementDeg = e.movementX / domElement.clientWidth * 360
        this.bearing += movementDeg
        console.log(this.bearing, this.object)
        this.object.rotation.z = degToRad(this.bearing)
      } else {
        // TODO pitch 处理有 bearing 的情况
        const movementDeg = e.movementY / domElement.clientHeight * 180
        this.pitch = clamp(0, this.pitch + movementDeg, 85)
        const negativePosition = this.object.position.clone()
        negativePosition.x = -negativePosition.x
        negativePosition.y = -negativePosition.y
        negativePosition.z = -negativePosition.z
        const spherical = new THREE.Spherical().setFromVector3(negativePosition)
        spherical.phi -= degToRad(this.pitch)
        const lookAtPosition = new THREE.Vector3().setFromSpherical(spherical)
        lookAtPosition.x -= negativePosition.x
        lookAtPosition.y -= negativePosition.y
        lookAtPosition.z -= negativePosition.z
        this.object.lookAt(lookAtPosition)
      }
    } else {
      // TODO 增加阻尼效果
      const spherical = new THREE.Spherical().setFromVector3(this.object.position)

      const movementYDeg = e.movementX / domElement.clientWidth * 36
      const movementXDeg = e.movementY / domElement.clientHeight * 36
      spherical.theta -= degToRad(movementYDeg) * Math.cos(degToRad(this.bearing)) + degToRad(movementXDeg) * Math.sin(degToRad(this.bearing))
      // TODO 处理小于 0 或者大于 180 的情况
      spherical.phi -= -degToRad(movementYDeg) * Math.sin(degToRad(this.bearing)) + degToRad(movementXDeg) * Math.cos(degToRad(this.bearing))

      const vector3 = new THREE.Vector3().setFromSpherical(spherical)
      this.object.position.x = vector3.x
      this.object.position.y = vector3.y
      this.object.position.z = vector3.z
      this.object.lookAt(0, 0, 0)
      this.object.rotateZ(degToRad(this.bearing))

      this.dispatchEvent({ type: 'change' })
    }
  }

  private onContextmenu (e: PointerEvent) {
    e.preventDefault()
  }

  private onMousewheel (e: WheelEvent) {
    e.preventDefault()

    const spherical = new THREE.Spherical().setFromVector3(this.object.position)
    const movement = 1000 / Math.pow(2, this.getZoom())
    if (e.deltaY > 0) {
      spherical.radius = Math.min(spherical.radius + movement, this.maxDistance)
    } else {
      spherical.radius = Math.max(spherical.radius - movement, this.minDistance)
    }
    const vector3 = new THREE.Vector3().setFromSpherical(spherical)
    this.object.position.x = vector3.x
    this.object.position.y = vector3.y
    this.object.position.z = vector3.z

    this.onEnd()
  }

  private onPointerup (e: PointerEvent) {
    e.preventDefault()

    this.dispatchEvent({ type: 'end' })
  }

  destroy () {
    this.destroyFnList.forEach(fn => fn())
  }
}

export default MapOrbitControls
