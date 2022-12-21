import * as THREE from 'three'
import { degToRad, radToDeg } from 'three/src/math/MathUtils'
import { getQuadraticEquationRes } from './math'
import equirectangularTile from './equirectangularTile'
import { XYZ } from '../types'
import mercatorTile from './mercatorTile'
import { range } from 'lodash-es'
import mercatorTile2equirectangularTileWorkerUrl from './mercatorTile2equirectangularTileWorker'

/**
 * 获取当前位置的 zoom
 * @param distance 镜头离圆心的距离
 * @param r 半径
 * @param fov 镜头视角
 * @returns
 */
export function getZoom (distance: number, r: number, fov: number) {
  let zoom = 1
  let criticalValue = 4 * r

  let arcLength = 0
  const tangentFov = getTangentFov(distance, r)
  if (fov >= tangentFov) {
    const R = Math.sin(degToRad(fov) / 2) * distance
    arcLength = degToRad(180 - fov) * R
  } else {
    arcLength = getDisplayArcLength(distance, r, fov)
  }

  while (arcLength < criticalValue) {
    const nextCriticalValue = criticalValue / 2
    zoom++
    if (arcLength >= nextCriticalValue) {
      return (
        zoom -
        (arcLength - nextCriticalValue) / (criticalValue - nextCriticalValue)
      )
    }
    criticalValue = nextCriticalValue
  }
  return zoom
}

/**
 * 获取刚好与球体相切的视角
 * @param distance 镜头离圆心的距离
 * @param r 半径
 * @returns
 */
export function getTangentFov (distance: number, r: number) {
  return radToDeg(Math.asin(r / distance)) * 2
}

/**
 * 获取显示区域圆弧长度
 * @param distance 镜头离圆心的距离
 * @param r 半径
 * @param fov 镜头视角
 * @returns
 */
export function getDisplayArcLength (distance: number, r: number, fov: number) {
  return degToRad(getDisplayCentralAngle(distance, r, fov)) * r
}

/**
 * 获取球体在镜头中可显示区域的圆心角
 * @param distance 镜头离圆心的距离
 * @param r 半径
 * @param fov 镜头视角
 * @returns
 */
export function getDisplayCentralAngle (
  distance: number,
  r: number,
  fov: number
) {
  const tangentFov = getTangentFov(distance, r)
  if (fov >= tangentFov) {
    return 180 - tangentFov
  }

  const halfFov = fov / 2
  const a = 1 + Math.pow(Math.tan(degToRad(halfFov)), 2)
  const b = -2 * distance
  const c = Math.pow(distance, 2) - Math.pow(r, 2)

  const α = radToDeg(
    2 *
      Math.acos((distance - Math.min(...getQuadraticEquationRes(a, b, c))) / r)
  )
  return α
}

export const lngLatToVector3 = (lngLat: number[], radius = 1) => {
  const theta = Math.PI * (lngLat[0] / 180)
  const phi = Math.PI * (0.5 - lngLat[1] / 180)
  const spherical = new THREE.Spherical(radius, phi, theta)
  return new THREE.Vector3().setFromSpherical(spherical)
}

export const vector3ToLngLat = (v3: THREE.Vector3) => {
  const spherical = new THREE.Spherical().setFromVector3(v3)
  return {
    lng: radToDeg(spherical.theta),
    lat: 90 - radToDeg(spherical.phi)
  }
}

export function getSatelliteUrl (x: number, y: number, z: number) {
  return `https://api.mapbox.com/v4/mapbox.satellite/${z}/${x}/${y}@2x.webp?sku=1015N1AhJztkE&access_token=pk.eyJ1IjoiZGluZ2xlaTIwMjEiLCJhIjoiY2wxbHh1aW54MDl6NDNrcGcwODNtaXNtbSJ9.6G649bdbNApupw2unoY0Yg`
}

export function getTerrainUrl (x: number, y: number, z: number) {
  return `https://api.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/${z}/${x}/${y}.webp?sku=101Tt60mCQMaF&access_token=pk.eyJ1IjoiZGluZ2xlaTIwMjEiLCJhIjoiY2wxbHh1aW54MDl6NDNrcGcwODNtaXNtbSJ9.6G649bdbNApupw2unoY0Yg`
}

export function equirectangularXyzToMercatorXyz (xyz: XYZ) {
  const [x, y, z] = xyz
  const [w, n, _e, s] = equirectangularTile.tileToBBOX(xyz)
  const mercatorBbox = mercatorTile.tileToBBOX(xyz)
  let y1 = y
  let y2 = y
  if (Math.min(s, mercatorTile.maxLat) > mercatorBbox[3]) {
    y1 = mercatorTile.pointToTile(w, s, z)[1]
  }
  if (Math.max(n, -mercatorTile.maxLat) < mercatorBbox[1]) {
    y2 = mercatorTile.pointToTile(w, n, z)[1]
  }

  return range(y1, y2 + 1).map(_y => [x, _y, z])
}

// https://docs.mapbox.com/data/tilesets/guides/access-elevation-data/
export function colorToHeight (color: number[]) {
  return -10000 + ((color[0] * 256 * 256 + color[1] * 256 + color[2]) * 0.1)
}

export async function mercatorUrl2equirectangularCanvas (url: string, xyz: XYZ, tileSize: number) {
  return await new Promise<HTMLCanvasElement>(resolve => {
    new THREE.ImageLoader().load(url, img => {
      const canvas = document.createElement('canvas')
      canvas.width = tileSize
      canvas.height = tileSize

      const ctx = canvas.getContext('2d')
      if (ctx === null) return

      ctx.drawImage(img, 0, 0, img.width, img.height)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      const worker = new Worker(mercatorTile2equirectangularTileWorkerUrl)
      worker.postMessage({
        imageData,
        tileSize,
        xyz,
      })
      // 主线程监听worker线程返回的数据
      worker.addEventListener('message', function (e) {
        ctx.putImageData(new ImageData(e.data, canvas.width, canvas.height), 0, 0)
        resolve(canvas)

        worker.terminate() // 使用完后需关闭 Worker
      })
    })
  })
}
