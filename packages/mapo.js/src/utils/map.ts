import * as THREE from 'three'
import { degToRad, radToDeg } from 'three/src/math/MathUtils'
import { getQuadraticEquationRes } from './math'
import { LngLat } from '../types'

/**
 * 获取当前位置的 zoom
 * @param distance 镜头离圆心的距离
 * @param r 半径
 * @param fov 镜头视角
 * @returns
 */
// export function getZoom (distance: number, r: number, fov: number) {
//   let zoom = 1
//   let criticalValue = 4 * r

//   let arcLength = 0
//   const tangentFov = getTangentFov(distance, r)
//   if (fov >= tangentFov) {
//     const R = Math.sin(degToRad(fov) / 2) * distance
//     arcLength = degToRad(180 - fov) * R
//   } else {
//     arcLength = getDisplayArcLength(distance, r, fov)
//   }

//   while (arcLength < criticalValue) {
//     const nextCriticalValue = criticalValue / 2
//     zoom++
//     if (arcLength >= nextCriticalValue) {
//       return zoom -
//       (arcLength - nextCriticalValue) / (criticalValue - nextCriticalValue)
//     }
//     criticalValue = nextCriticalValue
//   }
//   return zoom
// }

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
// export function getDisplayArcLength (distance: number, r: number, fov: number) {
//   return degToRad(getDisplayCentralAngle(distance, r, fov)) * r
// }

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

export function lngLatToVector3 (lngLat: LngLat, radius: number) {
  const theta = Math.PI * (lngLat[0] / 180)
  const phi = Math.PI * (0.5 - lngLat[1] / 180)
  const spherical = new THREE.Spherical(radius, phi, theta)
  return new THREE.Vector3().setFromSpherical(spherical)
}

export function vector3ToLngLat (v3: THREE.Vector3): LngLat {
  const spherical = new THREE.Spherical().setFromVector3(v3)
  return sphericalToLngLat(spherical)
}

export function sphericalToLngLat (spherical: THREE.Spherical): LngLat {
  return [radToDeg(spherical.theta), 90 - radToDeg(spherical.phi)]
}

export function getSatelliteUrl (x: number, y: number, z: number) {
  return `https://api.mapbox.com/v4/mapbox.satellite/${z}/${x}/${y}@2x.webp?sku=1015N1AhJztkE&access_token=pk.eyJ1IjoiZGluZ2xlaTIwMjEiLCJhIjoiY2wxbHh1aW54MDl6NDNrcGcwODNtaXNtbSJ9.6G649bdbNApupw2unoY0Yg`
}

export function getTerrainUrl (x: number, y: number, z: number) {
  return `https://api.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/${z}/${x}/${y}.webp?sku=101Tt60mCQMaF&access_token=pk.eyJ1IjoiZGluZ2xlaTIwMjEiLCJhIjoiY2wxbHh1aW54MDl6NDNrcGcwODNtaXNtbSJ9.6G649bdbNApupw2unoY0Yg`
}

// https://docs.mapbox.com/data/tilesets/guides/access-elevation-data/
export function colorToHeight (color: number[]) {
  return -10000 + ((color[0] * 256 * 256 + color[1] * 256 + color[2]) * 0.1)
}
