import * as THREE from 'three'
import Stats from 'three/examples/jsm/libs/stats.module'
import { BBox, MapOptions } from './types'
import EarthOrbitControls, { EarthOrbitControlsOptions } from './EarthOrbitControls'
import Layer from './layers/Layer'
import LayerManager from './layers/LayerManager'
import TileLayer from './layers/TileLayer'
import { degToRad } from './utils/math'
import { throttle } from 'lodash-es'

class Map {
  tileSize = 512
  // 地球半径 6371km
  earthRadius = 6371

  renderer = new THREE.WebGLRenderer()
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera()

  earthOrbitControls: EarthOrbitControls

  ctx: CanvasRenderingContext2D
  private layerManager: LayerManager

  private disposeFuncList: Array<() => void> = []

  constructor (options: MapOptions) {
    const container =
      typeof options.container === 'string'
        ? document.body.querySelector(options.container)
        : options.container
    if (container == null) {
      console.error('can not find container')
      return
    }

    const pixelRatio = container.clientWidth / container.clientHeight
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(pixelRatio)
    container.appendChild(this.renderer.domElement)
    this.disposeFuncList.push(() => this.renderer.dispose())

    const { earthRadius } = this

    let stats: Stats | undefined
    if (options.fps) {
      stats = Stats()
      stats.dom.style.position = 'absolute'
      container.appendChild(stats.dom)
    }

    this.scene.background = new THREE.Color(0x020924)
    // this.scene.fog = new THREE.Fog(0x020924, 200, 1000)

    this.addBackground()

    // 镜头控制器
    this.createEarthOrbitControls({
      domElement: this.renderer.domElement,
      earthRadius,
      lngLat: options.center,
      zoom: options.zoom,
      hash: options.hash
    })

    const bbox = this.getBBox()
    const mapGeometry = new THREE.SphereGeometry(
      earthRadius,
      512 * 2,
      512,
      degToRad(-90),
      degToRad(bbox[2] - bbox[0]),
      0,
      degToRad(bbox[3] - bbox[1]),
    )
    const mapMaterial = new THREE.MeshBasicMaterial({
      map: this.createCanvasTexture(bbox),
    })
    const earth = new THREE.Mesh(mapGeometry, mapMaterial)
    this.scene.add(earth)

    // this.layerManager.canvas.style.width = '100%'
    // container.insertBefore(this.layerManager.canvas, container.childNodes[0])

    // 页面重绘动画
    const tick = () => {
      stats?.update()
      // 更新渲染器
      this.renderer.render(this.scene, this.earthOrbitControls.camera)
      // 页面重绘时调用自身
      const id = window.requestAnimationFrame(tick)
      this.disposeFuncList.push(() => window.cancelAnimationFrame(id))
    }
    tick()

    const ro = new ResizeObserver(() => {
      const _pixelRatio = container.clientWidth / container.clientHeight

      this.renderer.setPixelRatio(_pixelRatio)
      this.renderer.setSize(container.clientWidth, container.clientHeight)

      const { camera } = this.earthOrbitControls
      camera.aspect = _pixelRatio
      camera.updateProjectionMatrix()
    })
    ro.observe(container)
    this.disposeFuncList.push(() => ro.disconnect())

    this.openAuxiliaryLine()
  }

  addBackground () {
    const { earthRadius } = this
    // 因为是球体，需要将图片横向和竖向各翻转一次，让图片边界可以正常衔接
    const reverseRepeat = 2
    const heightSegments = reverseRepeat * 100
    const widthSegments = heightSegments
    const widthPositionCount = widthSegments + 1
    const heightPositionCount = heightSegments + 1

    const backgroundGeometry = new THREE.SphereGeometry(earthRadius * 1000, widthSegments, heightSegments)

    const uv: number[] = []
    for (let y = 0; y < heightPositionCount; y++) {
      for (let x = 0; x < widthPositionCount; x++) {
        const xUv = (x * reverseRepeat / widthSegments) % reverseRepeat
        const yUv = (y * reverseRepeat / heightSegments) % reverseRepeat
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

    const texture = new THREE.TextureLoader().load('./images/01-earth-splash-stars-ltr.webp')
    texture.minFilter = THREE.NearestFilter
    const backgroundMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    })

    const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial)
    this.scene.add(background)
  }

  openAuxiliaryLine () {
    const originPoint = new THREE.Vector3(0, 0, 0)
    const arr: Array<[THREE.Vector3, number]> = [
      [new THREE.Vector3(this.earthRadius * 2, 0, 0), 0xff0000],
      [new THREE.Vector3(0, this.earthRadius * 2, 0), 0x00ff00],
      [new THREE.Vector3(0, 0, this.earthRadius * 2), 0x0000ff]
    ]
    arr.forEach(([targetPoint, color]) => {
      this.scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([originPoint, targetPoint]),
          new THREE.LineBasicMaterial({
            color,
            fog: false
          })
        )
      )
    })
  }

  getBBox (): BBox {
    const [w, n, e, s] = this.earthOrbitControls.bbox
    const scale = 3
    const lngGap = e - w
    const latGap = s - n
    const max = Math.max(lngGap, latGap)

    if (max * scale >= 180) {
      return [-180, -90, 180, 90]
    }

    const translateLng = (scale - 1) / 2 * lngGap
    const translateLat = (scale - 1) / 2 * latGap
    return [w - translateLng, s - translateLat, e + translateLng, n + translateLat]
  }

  createEarthOrbitControls (options: EarthOrbitControlsOptions) {
    const controls = new EarthOrbitControls(options)

    const onMove = throttle(() => {
      this.layerManager.displayBBox = controls.bbox
      this.layerManager.update()
    }, 500)
    controls.addEventListener('move', onMove)
    controls.addEventListener('end', () => {
      // changed()
    })
    controls.addEventListener('zoom', () => {
      // const bbox = this.getBBox()
      // this.updateCanvasSize(bbox)
    })
    this.earthOrbitControls = controls
    return controls
  }

  updateCanvasSize (bbox: BBox) {
    const { layerManager, earthOrbitControls } = this
    const scale = earthOrbitControls.domElement.clientWidth / (earthOrbitControls.bbox[2] - earthOrbitControls.bbox[0])
    layerManager.canvas.width = Math.ceil((bbox[2] - bbox[0]) * scale)
    layerManager.canvas.height = Math.ceil((bbox[3] - bbox[1]) * scale)
    console.log('width:', layerManager.canvas.width)
    console.log('height:', layerManager.canvas.height)
  }

  createCanvasTexture (bbox: BBox) {
    const { tileSize, earthOrbitControls } = this
    const layerManager = new LayerManager()
    this.disposeFuncList.push(() => layerManager.dispose())

    layerManager.bbox = bbox
    layerManager.displayBBox = earthOrbitControls.bbox
    layerManager.z = earthOrbitControls.z

    const tileLayer = new TileLayer(tileSize)
    tileLayer.zIndex = -1
    void tileLayer.preload().then(() => {
      layerManager.addLayer(tileLayer)
    })

    const texture = new THREE.CanvasTexture(layerManager.canvas)
    texture.minFilter = THREE.NearestFilter
    const update = () => {
      texture.needsUpdate = true
    }
    layerManager.addEventListener('update', update)
    this.disposeFuncList.push(() => layerManager.removeEventListener('update', update))

    this.layerManager = layerManager
    this.updateCanvasSize(bbox)

    return texture
  }

  addLayer (layer: Layer) {
    this.layerManager.addLayer(layer)
  }

  removeLayer (layer: Layer) {
    this.layerManager.removeLayer(layer)
  }

  dispose () {
    this.disposeFuncList.forEach(func => func())
    this.disposeFuncList = []
  }
}

export default Map
