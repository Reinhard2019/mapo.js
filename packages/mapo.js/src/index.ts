import { chunk, floor, range, round } from 'lodash-es'
import * as THREE from 'three'
import Stats from 'three/examples/jsm/libs/stats.module'
import { degToRad, radToDeg } from 'three/src/math/MathUtils'
import {
  getDisplayCentralAngle,
  getZoom,
  vector3ToLngLat,
  getSatelliteUrl,
  getTerrainUrl,
  mercatorUrl2equirectangularCanvas,
  colorToHeight
} from './utils/map'
import { MapOptions, XYZ } from './types'
import { inflate, multiply } from './utils/array'
import MapOrbitControls from './MapOrbitControls'
import mercatorTile from './utils/mercatorTile'

// 地球半径 6371km
const earthRadius = 6371
const fov = 60

class Mapo {
  renderer = new THREE.WebGLRenderer()
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera()
  tileSize = 512

  private readonly destroyFnList: Array<() => void> = []

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
    this.destroyFnList.push(() => this.renderer.dispose())

    const camera = new THREE.PerspectiveCamera(
      fov,
      pixelRatio,
      0.1,
      earthRadius * 10
    )
    camera.position.set(-earthRadius * 2, 0, 0)
    camera.lookAt(0, 0, 0)

    const stats = Stats()
    container.appendChild(stats.dom)

    this.scene.background = new THREE.Color(0x020924)
    // this.scene.fog = new THREE.Fog(0x020924, 200, 1000)

    const mesh = this.createMesh([0, 0, 0], {
      materialOptions: {
        depthWrite: false,
      }
    })
    mesh.renderOrder = -1
    this.scene.add(mesh)

    // 镜头控制器
    this.createOrbitControls(camera, this.renderer.domElement)

    // 页面重绘动画
    const tick = () => {
      stats.update()
      // 更新渲染器
      this.renderer.render(this.scene, camera)
      // 页面重绘时调用自身
      const id = window.requestAnimationFrame(tick)
      this.destroyFnList.push(() => window.cancelAnimationFrame(id))
    }
    tick()

    const ro = new ResizeObserver(() => {
      this.renderer.setSize(container.clientWidth, container.clientHeight)
      const _pixelRatio = container.clientWidth / container.clientHeight
      this.renderer.setPixelRatio(_pixelRatio)
      camera.aspect = _pixelRatio
      camera.updateProjectionMatrix()
    })
    ro.observe(container)
    this.destroyFnList.push(() => ro.disconnect())

    this.camera = camera

    this.openAuxiliaryLine()
  }

  openAuxiliaryLine () {
    const originPoint = new THREE.Vector3(0, 0, 0)
    const arr: Array<[THREE.Vector3, number]> = [
      [new THREE.Vector3(earthRadius * 2, 0, 0), 0xff0000],
      [new THREE.Vector3(0, earthRadius * 2, 0), 0x00ff00],
      [new THREE.Vector3(0, 0, earthRadius * 2), 0x0000ff]
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

  createOrbitControls (camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    const controls = new MapOrbitControls({ object: camera, domElement, earthRadius })

    const changed = () => {
      const zoom = getZoom(controls.getDistance(), earthRadius, fov)
      const z = round(zoom)
      const lngLat = vector3ToLngLat(camera.position)

      // const rotate = 0
      // const pan = 0
      location.hash = `${floor(zoom, 2)}/${floor(lngLat.lng, 3)}/${floor(
        lngLat.lat,
        3
      )}`

      // 移除 z 更大的 group
      this.scene.children.forEach((object) => {
        if (object instanceof THREE.Group && z !== Number(object.name)) {
          object.children.forEach(child => {
            if (child instanceof THREE.Mesh) {
              const _child = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial | THREE.MeshBasicMaterial[]>
              _child.geometry.dispose()
              inflate(_child.material).forEach(material => {
                material.map?.dispose()
                material.dispose()
              })
            }
          })
          this.scene.remove(object)
        }
      })

      const centralYAngle = getDisplayCentralAngle(
        controls.getDistance(),
        earthRadius,
        fov
      )
      const halfCentralYAngle = centralYAngle / 2
      const fovX = radToDeg(Math.atan(domElement.clientWidth / (domElement.clientHeight / Math.tan(degToRad(fov / 2))))) * 2
      const centralXAngle = getDisplayCentralAngle(
        controls.getDistance(),
        earthRadius,
        fovX
      )
      const halfCentralXAngle = centralXAngle / 2
      // TODO 先加载中间的
      // TODO 宽度比高度更大时加载不全
      const bbox = [
        lngLat.lng - halfCentralXAngle,
        lngLat.lat - halfCentralYAngle,
        lngLat.lng + halfCentralXAngle,
        lngLat.lat + halfCentralYAngle
      ].map((v, i) => {
        switch (i) {
          case 0:
            return v >= -180 ? v : 360 + v
          case 1:
            return v >= -90 ? v : 180 + v
          case 2:
            return v <= 180 ? v : v - 360
          case 3:
            return v <= 90 ? v : v - 180
          default:
            return 0
        }
      })
      const [x1, y1] = mercatorTile.pointToTile(bbox[0], bbox[1], z)
      const [x2, y2] = mercatorTile.pointToTile(bbox[2], bbox[3], z)
      multiply(range(x1, x2 + 1), range(y2, y1 + 1)).forEach(([x, y]) => {
        const xyz: XYZ = [x, y, z]
        let group = this.scene.children.find(
          (object) => object instanceof THREE.Group && object.name === String(z)
        )
        if (group == null) {
          group = new THREE.Group()
          group.name = String(z)
          this.scene.add(group)
        }
        if (group.children.some((mesh) => mesh.name === xyz.join())) {
          return
        }
        const mesh = this.createMesh(xyz, {
          // elevation: z > 5
        })
        mesh.name = xyz.join()
        group.add(mesh)
      })
    }

    controls.addEventListener('change', () => {
      // const zoom = getZoom(this.getDistance(), earthRadius, object.fov)
      // this.zoomSpeed = 10 / Math.pow(2, zoom)
    })
    controls.addEventListener('end', () => {
      changed()
      console.log('end', this.scene)
    })
    changed()
    return controls
  }

  createMesh (xyz: XYZ, options?: {
    elevation?: boolean
    materialOptions?: THREE.MeshBasicMaterialParameters
  }) {
    const { elevation, materialOptions } = options || {}
    // TODO 底图需要扩展南极和北极部分
    const { tileSize } = this
    const mesh = new THREE.Mesh()
    // TODO 如果在图片加载前，mesh 被移除，则需要取消加载
    mesh.userData.cancel = () => {}

    let terrainLoaded = false
    void mercatorUrl2equirectangularCanvas(getSatelliteUrl(...xyz), xyz, tileSize).then((canvas) => {
      const [x, y, z] = xyz

      const material = new THREE.MeshBasicMaterial({
        fog: false,
        map: new THREE.CanvasTexture(canvas),
        ...materialOptions
      })
      mesh.material = material

      if (!terrainLoaded) {
        // 某一行或某一列的瓦片数量
        const z2 = Math.pow(2, z)
        const lngGap = 360 / z2
        const n = 90 - mercatorTile.yToLat(y, z)
        const s = 90 - mercatorTile.yToLat(y + 1, z)
        const geometry = new THREE.SphereGeometry(
          earthRadius,
          (2 * Math.pow(2, 10)) / z2,
          Math.pow(2, 10) / z2,
          degToRad(-90 + lngGap * x),
          degToRad(lngGap),
          degToRad(n),
          degToRad(s - n)
        )

        mesh.geometry = geometry
      }
    })

    if (elevation) {
      void mercatorUrl2equirectangularCanvas(getTerrainUrl(...xyz), xyz, tileSize).then(canvas => {
        terrainLoaded = true

        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const pixelList = chunk<number>(imageData.data, 4)
        const pixelLineList = chunk(pixelList, tileSize)
        const lngGap = 360 / tileSize
        const latGap = mercatorTile.maxLat * 2 / tileSize

        const geometry = new THREE.BufferGeometry()
        const vertices = Array(tileSize + 1).fill(0).flatMap((_, y) => {
          return Array(tileSize + 1).fill(0).flatMap((_, x) => {
            const lng = lngGap * x - 180
            const lat = mercatorTile.maxLat - latGap * y
            const elevation = pixelLineList[y]?.[x] ? colorToHeight(pixelLineList[y][x]) : 0
            // 单位: km
            const elevationKm = elevation / 1000
            const vector3 = new THREE.Vector3().setFromSpherical(new THREE.Spherical(earthRadius + elevationKm, degToRad(90 - lat), degToRad(lng)))
            return [vector3.x, vector3.y, vector3.z]
          })
        })
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3))
        const uv = Array((tileSize + 1)).fill(0).flatMap((_, yIndex) => {
          return Array((tileSize + 1)).fill(0).flatMap((_, xIndex) => {
            return [xIndex / (tileSize), 1 - yIndex / (tileSize)]
          })
        })
        geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2))
        const index = Array(tileSize).fill(0).flatMap((_, y) => {
          const nextY = y + 1
          return Array(tileSize).fill(0).flatMap((_, x) => {
            const nextX = x + 1
            const p1 = y * (tileSize + 1) + x
            const p2 = y * (tileSize + 1) + nextX
            const p3 = nextY * (tileSize + 1) + x
            const p4 = nextY * (tileSize + 1) + nextX
            const face1 = [p1, p3, p2]
            const face2 = [p2, p3, p4]
            return [
              ...face1,
              ...face2
            ]
          })
        })
        geometry.setIndex(index)
        mesh.geometry = geometry
      })
    }

    return mesh
  }

  destroy () {
    this.destroyFnList.forEach(fn => fn())
  }
}

export default Mapo
