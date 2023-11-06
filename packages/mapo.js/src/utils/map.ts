import * as THREE from 'three'
import { degToRad, getQuadraticEquationRes, radToDeg } from './math'
import { LngLat, XYZ } from '../types'

/**
 * 获取当前距离上刚好与球体相切的视角
 * @param distance 镜头离圆心的距离
 * @param r 半径
 * @returns
 */
export function getTangentFov(distance: number, r: number) {
  return radToDeg(Math.asin(r / distance)) * 2
}

/**
 * 获取当前距离上刚好与视角相切的圆的半径
 * @param distance 镜头离圆心的距离
 * @param fov 视角
 * @returns
 */
export function getTangentRadius(distance: number, fov: number) {
  return Math.sin(degToRad(fov / 2)) * distance
}

/**
 * 获取球体在镜头中可显示区域的圆心角
 * @param distance 镜头离圆心的距离
 * @param r 半径
 * @param fov 镜头视角
 * @returns
 */
export function getDisplayCentralAngle(distance: number, r: number, fov: number) {
  const tangentFov = getTangentFov(distance, r)
  if (fov >= tangentFov) {
    return 180 - tangentFov
  }

  const halfFov = fov / 2
  const a = 1 / Math.pow(Math.cos(degToRad(halfFov)), 2)
  const b = -2 * distance
  const c = Math.pow(distance, 2) - Math.pow(r, 2)

  // 摄像头到弦心的距离
  const distanceFromTheCameraToTheChord = Math.min(...getQuadraticEquationRes(a, b, c))

  const α = radToDeg(2 * Math.acos((distance - distanceFromTheCameraToTheChord) / r))
  return α
}

export function lngLatToVector3(lngLat: LngLat, radius: number) {
  const [lng, lat] = lngLat
  return new THREE.Vector3().setFromSphericalCoords(radius, degToRad(90 - lat), degToRad(lng))
}

export function vector3ToLngLat(v3: THREE.Vector3): LngLat {
  const spherical = new THREE.Spherical().setFromVector3(v3)
  return sphericalToLngLat(spherical)
}

export function sphericalToLngLat(spherical: THREE.Spherical): LngLat {
  return [radToDeg(spherical.theta), 90 - radToDeg(spherical.phi)]
}

export function getSatelliteUrl(x: number, y: number, z: number) {
  return `https://api.mapbox.com/v4/mapbox.satellite/${z}/${x}/${y}@2x.webp?sku=1015N1AhJztkE&access_token=pk.eyJ1IjoiZGluZ2xlaTIwMjEiLCJhIjoiY2wxbHh1aW54MDl6NDNrcGcwODNtaXNtbSJ9.6G649bdbNApupw2unoY0Yg`
}

export function getTerrainUrl(x: number, y: number, z: number) {
  return `https://api.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/${z}/${x}/${y}.webp?sku=101Tt60mCQMaF&access_token=pk.eyJ1IjoiZGluZ2xlaTIwMjEiLCJhIjoiY2wxbHh1aW54MDl6NDNrcGcwODNtaXNtbSJ9.6G649bdbNApupw2unoY0Yg`
}

/**
 * 将鼠标位置转化为射线
 * @param point
 * @returns
 */
export function mousePosition2Raycaster(
  point: THREE.Vector2,
  container: HTMLElement,
  camera: THREE.PerspectiveCamera,
): THREE.Raycaster {
  // 将鼠标位置归一化为设备坐标。x 和 y 方向的取值范围是 (-1 to +1)
  const x = (point.x / container.clientWidth) * 2 - 1
  const y = -(point.y / container.clientHeight) * 2 + 1

  const raycaster = new THREE.Raycaster()
  // 通过摄像机和鼠标位置更新射线
  raycaster.setFromCamera(new THREE.Vector2(x, y), camera)

  return raycaster
}

/**
 * 根据像素获取海拔
 * 单位: m
 * https://docs.mapbox.com/data/tilesets/guides/access-elevation-data/
 * @param color
 * @returns
 */
export function rgb2elevation(color: ArrayLike<number>) {
  return -10000 + (color[0] * 256 * 256 + color[1] * 256 + color[2]) * 0.1
}

export function normalizeLng(lng: number) {
  if (lng > 0) {
    return ((lng + 180) % 360) - 180
  } else {
    return ((lng - 180) % 360) + 180
  }
}

/**
 * tileIndex 有可能小于 0 或者大于等于 z2，需要对其进行格式化
 * @param tileIndex
 * @returns
 */
export function formatTileIndex(tileIndex: number, z: number) {
  const z2 = Math.pow(2, z)
  return tileIndex < 0 ? z2 + tileIndex : tileIndex % z2
}

/**
 * 获取上方邻近的 xyz
 * @param xyz
 * @returns
 */
export function getTopNearXYZ(xyz: XYZ): XYZ {
  const [x, y, z] = xyz
  return [x, formatTileIndex(y - 1, z), z]
}

/**
 * 获取左边邻近的 xyz
 * @param xyz
 * @returns
 */
export function getLeftNearXYZ(xyz: XYZ): XYZ {
  const [x, y, z] = xyz
  return [formatTileIndex(x - 1, z), y, z]
}

/**
 * 获取下方邻近的 xyz
 * @param xyz
 * @returns
 */
export function getBottomNearXYZ(xyz: XYZ): XYZ {
  const [x, y, z] = xyz
  return [x, formatTileIndex(y + 1, z), z]
}

/**
 * 获取右边邻近的 xyz
 * @param xyz
 * @returns
 */
export function getRightNearXYZ(xyz: XYZ): XYZ {
  const [x, y, z] = xyz
  return [formatTileIndex(x + 1, z), y, z]
}
