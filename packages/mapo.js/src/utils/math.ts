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
