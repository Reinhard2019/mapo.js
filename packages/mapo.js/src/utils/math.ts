import * as THREE from 'three'

/**
 * 获取一元二次方程的解
 */
export function getQuadraticEquationRes (a: number, b: number, c: number) {
  const sqrtRes = Math.sqrt(Math.pow(b, 2) - 4 * a * c)
  return [(-b + sqrtRes) / (2 * a), (-b - sqrtRes) / (2 * a)]
}

/**
 * 角度转弧度
 * !!! 会用于 Web Worker
 * @param degrees
 */
export function degToRad (degrees: number) {
  return degrees / 180 * Math.PI
}

/**
 * 弧度转角度
 * !!! 会用于 Web Worker
 * @param degrees
 */
export function radToDeg (radian: number) {
  return radian / Math.PI * 180
}

/**
 * 罗德里格旋转公式
 * @param t 旋转向量
 * @param k 旋转轴
 * @param r 旋转角度
 */
export function rodrigo (t: THREE.Vector3, k: THREE.Vector3, r: number) {
  const [u, v, w] = t.toArray()
  const [x, y, z] = k.toArray()
  const sin = Math.sin(r)
  const cos = Math.cos(r)
  const m = (x * u + y * v + z * w) * (1 - cos)
  const result: THREE.Vector3 = new THREE.Vector3(
    u * cos + (y * w - z * v) * sin + x * m,
    v * cos + (z * u - x * w) * sin + y * m,
    w * cos + (x * v - y * u) * sin + z * m,
  )
  return result
}
