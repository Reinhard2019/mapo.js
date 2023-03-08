import * as THREE from 'three'
import Stats from 'three/examples/jsm/libs/stats.module.js'
import { BBox, EarthOrbitControlsOptions, LngLat, MapOptions, Point2 } from './types'
import EarthOrbitControls from './EarthOrbitControls'
import BaseLayer from './layers/BaseLayer'
import LayerManager from './layers/LayerManager'
import TileLayer from './layers/TileLayer'
import { floor, last, throttle } from 'lodash-es'
import EarthGeometry from './EarthGeometry'
import MercatorTile from './utils/MercatorTile'
import { bboxContains, fullBBox, isFull, latPretreatmentBBox, scale } from './utils/bbox'
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

class Map extends THREE.EventDispatcher {
  tileSize = 512
  // 地球半径 6371km
  readonly earthRadius = 6371

  readonly renderer = new THREE.WebGLRenderer()
  readonly scene = new THREE.Scene()
  readonly hash: boolean = false

  private readonly earthOrbitControls: EarthOrbitControls
  private readonly earthGeometry: EarthGeometry
  private readonly earthMesh = new THREE.Mesh()
  private readonly container: HTMLElement

  private layerManager: LayerManager
  private readonly beforeLayerManager: BeforeLayerManager
  private tileLayer: TileLayer

  private disposeFuncList: Array<() => void> = []

  /**
   * 安全区域，如果 displayBBox 超出了安全区域，则需要更新 preloadBBox
   */
  secureBBox?: BBox

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

    const pixelRatio = container.clientWidth / container.clientHeight
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(pixelRatio)
    container.appendChild(this.renderer.domElement)
    this.disposeFuncList.push(() => this.renderer.dispose())

    const { earthRadius, tileSize } = this

    let stats: Stats | undefined
    if (options.fps) {
      stats = Stats()
      stats.dom.style.position = 'absolute'
      container.appendChild(stats.dom)
    }

    this.scene.background = new THREE.Color(0x020924)
    // this.scene.fog = new THREE.Fog(0x020924, 200, 1000)

    // this.addBackground()

    // 镜头控制器
    const hashOptions = this.parseHash()
    this.earthOrbitControls = new EarthOrbitControls({
      domElement: container,
      earthRadius,
      center: options.center,
      zoom: options.zoom,
      bearing: options.bearing,
      ...hashOptions,
    })
    this.initEarthOrbitControls()

    this.earthGeometry = new EarthGeometry({
      earthRadius,
      tileSize,
      z: this.earthOrbitControls.z,
      delay: true,
    })
    this.disposeFuncList.push(() => this.earthGeometry.dispose())
    this.earthMesh.geometry = this.earthGeometry
    this.earthMesh.userData.id = 'test'
    this.scene.add(this.earthMesh)
    this.initEarthMaterial()

    this.beforeLayerManager = new BeforeLayerManager({
      container,
      map: this,
      earthOrbitControls: this.earthOrbitControls,
    })

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

  private updatePreloadBBox(_preloadBBox?: BBox) {
    const preloadBBox = _preloadBBox ?? this.getPreloadBBox()
    const displayBBox = bbox(this.getDisplayPolygon()) as BBox
    if (!isFull(preloadBBox)) {
      this.secureBBox = this.getSecureBBox()
    }

    this.earthGeometry.bbox = preloadBBox
    this.earthGeometry.update()

    this.tileLayer.bbox = preloadBBox
    this.tileLayer.displayBBox = displayBBox
    this.tileLayer.z = this.earthOrbitControls.z
    void this.tileLayer.refresh()

    this.layerManager.bbox = preloadBBox
    this.layerManager.displayBBox = displayBBox
    this.layerManager.z = this.earthOrbitControls.z
    this.layerManager.updateCanvasSize(this.earthOrbitControls.getPxDeg())
    this.layerManager.refresh()
  }

  private initEarthOrbitControls() {
    const onMove = throttle(() => {
      this.updateHash()
      this.beforeLayerManager.refresh()

      const secureBBox = this.secureBBox
      const cachePreloadBBox = this.earthGeometry.bbox
      const preloadBBox = this.getPreloadBBox()
      const displayBBox = bbox(this.getDisplayPolygon()) as BBox

      if (bboxContains(cachePreloadBBox, preloadBBox)) {
        this.updatePreloadBBox()
        return
      }

      const overflowSecureBBox = secureBBox && !bboxContains(secureBBox, displayBBox)
      if (overflowSecureBBox) {
        this.updatePreloadBBox()
      }
    }, 500)
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
  }

  private getPreloadBBox(): BBox {
    let preloadBBox: BBox = scale(bbox(this.getDisplayPolygon()) as BBox, 3)
    preloadBBox = latPretreatmentBBox(preloadBBox)

    if (preloadBBox[2] - preloadBBox[0] > 180) {
      preloadBBox[0] = -180
      preloadBBox[2] = 180
    }

    return preloadBBox
  }

  private getSecureBBox(): BBox {
    return latPretreatmentBBox(scale(bbox(this.getDisplayPolygon()) as BBox, 2))
  }

  private parseHash(): Pick<EarthOrbitControlsOptions, 'zoom' | 'center' | 'bearing'> | undefined {
    if (this.hash && location.hash.startsWith('#')) {
      const [zoom, lng, lat, bearing] = location.hash.slice(1).split('/')
      return {
        zoom: parseFloat(zoom),
        center: [parseFloat(lng), parseFloat(lat)],
        bearing: parseFloat(bearing),
      }
    }
  }

  private updateHash() {
    const { zoom, center, bearing } = this.earthOrbitControls
    if (this.hash) {
      const arr = [floor(zoom, 2), floor(center[0], 3), floor(center[1], 3), floor(bearing, 2)]
      history.replaceState(null, '', `#${arr.join('/')}`)
    }
  }

  private initEarthMaterial() {
    const { tileSize } = this

    const materials: THREE.ShaderMaterial[] = []

    const backgroundMaterial = new THREE.ShaderMaterial({
      fragmentShader: `
        void main() {
          gl_FragColor = vec4(0, 0, 0, 1);
        }
      `,
    })
    materials.push(backgroundMaterial)

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `

    // 创建 tileMaterial
    {
      const tileLayer = new TileLayer(tileSize)
      this.tileLayer = tileLayer
      const getTexture = () => new THREE.CanvasTexture(tileLayer.canvas)
      tileLayer.onUpdate = () => {
        uniforms.bbox.value = tileLayer.bbox
        uniforms.canvasBBox.value = tileLayer.canvasBBox
        uniforms.startCanvasY.value = MercatorTile.latToY(tileLayer.canvasBBox[1], 0)
        uniforms.endCanvasY.value = MercatorTile.latToY(tileLayer.canvasBBox[3], 0)
        uniforms.tile.value.dispose()
        uniforms.tile.value = getTexture()
      }
      const uniforms = {
        tile: { value: getTexture() },
        bbox: { value: fullBBox },
        canvasBBox: { value: fullBBox },
        startCanvasY: { value: MercatorTile.latToY(fullBBox[1], 0) },
        endCanvasY: { value: MercatorTile.latToY(fullBBox[3], 0) },
      }
      // 将 lat(纬度) 转化为墨卡托投影中的 y(0-1)
      const latToY = `
        float latToY(float lat) {
          if (lat >= ${MercatorTile.maxLat}) {
            return 0.0;
          }
          if (lat <= ${-MercatorTile.maxLat}) {
            return 1.0;
          }

          float sinValue = sin(radians(lat));
          float y = (0.5 - (0.25 * log((1.0 + sinValue) / (1.0 - sinValue))) / ${Math.PI});
          return y;
        }
      `
      const fragmentShader = `
        uniform sampler2D tile;
        uniform sampler2D layers;
        uniform vec4 bbox;
        uniform vec4 canvasBBox;
        uniform float startCanvasY;
        uniform float endCanvasY;
        varying vec2 vUv;

        ${latToY}

        void main() {
          float w = bbox[0];
          float s = bbox[1];
          float e = bbox[2];
          float n = bbox[3];
          float canvasW = canvasBBox[0];
          float canvasS = canvasBBox[1];
          float canvasE = canvasBBox[2];
          float canvasN = canvasBBox[3];

          float canvasLatGap = canvasE - canvasW;
          float scaleX = (e - w) / canvasLatGap;
          float startX = (w - canvasW) / canvasLatGap;
          float x = vUv.x * scaleX + startX;

          float lat = s + vUv.y * (n - s);
          float y = (latToY(lat) - startCanvasY) / (endCanvasY - startCanvasY);

          vec2 uv = vec2(x, y);
          gl_FragColor = texture2D(tile, uv);
        }
      `
      const tileMaterial = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
      })
      materials.push(tileMaterial)
    }

    // 创建 layersMaterial
    {
      const layerManager = new LayerManager()
      this.layerManager = layerManager
      this.disposeFuncList.push(() => layerManager.dispose())
      const getTexture = () => new THREE.CanvasTexture(layerManager.canvas)
      layerManager.onUpdate = () => {
        layersUniform.value.dispose()
        layersUniform.value = getTexture()
      }
      const layersUniform: THREE.IUniform<THREE.CanvasTexture> = {
        value: getTexture(),
      }
      const layersMaterial = new THREE.ShaderMaterial({
        uniforms: {
          layers: layersUniform,
        },
        vertexShader,
        fragmentShader: `
          uniform sampler2D layers;
          varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(layers, vUv);
          }
        `,
        transparent: true,
      })
      materials.push(layersMaterial)
    }

    materials.forEach((material, i) => {
      this.earthGeometry.addGroup(0, Infinity, i)
      this.disposeFuncList.push(() => material.dispose())
    })
    this.earthMesh.material = materials

    this.updatePreloadBBox()
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

  getDisplayPolygon() {
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
      const spliceIndex = lngLatArr.slice(0, -1).findIndex((v, i) => v[0] > lngLatArr[i + 1][0])
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
      return polygon([[...lngLatArr, lngLatArr[0]]])
    }

    lngLatArr[0][0] = lngLatArr[lngLatArr.length / 2][0] = this.earthOrbitControls.center[0]
    lngLatArr.slice(lngLatArr.length / 2 + 1).forEach(v => {
      if (v[0] < this.earthOrbitControls.center[0]) {
        v[0] += 360
      }
    })
    return polygon([[...lngLatArr, lngLatArr[0]]])
  }

  addLayer(layer: BaseLayer | BaseBeforeLayer) {
    if (layer instanceof BaseBeforeLayer) {
      this.beforeLayerManager.addLayer(layer)
    } else {
      this.layerManager.addLayer(layer)
    }
  }

  removeLayer(layer: BaseLayer | BaseBeforeLayer) {
    if (layer instanceof BaseBeforeLayer) {
      this.beforeLayerManager.removeLayer(layer)
    } else {
      this.layerManager.removeLayer(layer)
    }
  }

  private clearContainer() {
    this.container.childNodes.forEach(child => {
      this.container.removeChild(child)
    })
  }

  dispose() {
    this.disposeFuncList.forEach(func => func())
    this.disposeFuncList = []

    this.clearContainer()
  }
}

export default Map
