import * as THREE from 'three'

/**
 * 获取一元二次方程的解
 */
export function getQuadraticEquationRes(a: number, b: number, c: number) {
  const sqrtRes = Math.sqrt(Math.pow(b, 2) - 4 * a * c)
  return [(-b + sqrtRes) / (2 * a), (-b - sqrtRes) / (2 * a)]
}

/**
 * 角度转弧度
 * !!! 会用于 Web Worker
 * @param degrees
 */
export function degToRad(degrees: number) {
  return (degrees / 180) * Math.PI
}

/**
 * 弧度转角度
 * !!! 会用于 Web Worker
 * @param degrees
 */
export function radToDeg(radian: number) {
  return (radian / Math.PI) * 180
}

/**
 * 罗德里格旋转公式
 * @param t 旋转向量
 * @param k 旋转轴
 * @param r 旋转角度
 */
export function rodrigo(t: THREE.Vector3, k: THREE.Vector3, r: number) {
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

/**
 * 根据直角三角形的两条边获取斜边长
 * @param a
 * @param b
 * @returns
 */
export function hypotenuse(a: number, b: number) {
  return Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2))
}

/**
 * 将矩形分解为多个点，顺时针
 * @param params
 * @returns
 */
export function splitRectangle(params: {
  width: number
  height: number
  widthSegments: number
  heightSegments: number
}) {
  const { width, height, widthSegments, heightSegments } = params
  return [
    [0, 0],
    ...Array(widthSegments - 1)
      .fill(0)
      .map((_, i) => {
        return [((i + 1) / widthSegments) * width, 0]
      }),
    [width, 0],
    ...Array(heightSegments - 1)
      .fill(0)
      .map((_, i) => {
        return [width, ((i + 1) / heightSegments) * height]
      }),
    [width, height],
    ...Array(widthSegments - 1)
      .fill(0)
      .map((_, i) => {
        return [((widthSegments - (i + 1)) / widthSegments) * width, height]
      }),
    [0, height],
    ...Array(heightSegments - 1)
      .fill(0)
      .map((_, i) => {
        return [0, ((heightSegments - (i + 1)) / heightSegments) * height]
      }),
  ]
}

export function rectangleIntersect(width: number, height: number, deg: number) {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const diagonalDeg = radToDeg(Math.atan(width / height))
  const _deg = deg % 360

  if (_deg === 0) {
    return [halfWidth, 0]
  }
  if (_deg < diagonalDeg) {
    return [halfWidth + halfHeight * Math.tan(degToRad(_deg)), 0]
  }
  if (_deg === diagonalDeg) {
    return [width, 0]
  }
  if (_deg < 90) {
    return [width, halfHeight - halfWidth * Math.tan(degToRad(90 - _deg))]
  }
  if (_deg === 90) {
    return [width, halfHeight]
  }
  if (_deg < 180 - diagonalDeg) {
    return [width, halfHeight + halfWidth * Math.tan(degToRad(_deg - 90))]
  }
  if (_deg === 180 - diagonalDeg) {
    return [width, height]
  }
  if (_deg < 180) {
    return [halfWidth + halfHeight * Math.tan(degToRad(180 - _deg)), height]
  }
  if (_deg === 180) {
    return [halfWidth, height]
  }
  if (_deg < 180 + diagonalDeg) {
    return [halfWidth - halfHeight * Math.tan(degToRad(_deg % 180)), height]
  }
  if (_deg === 180 + diagonalDeg) {
    return [0, height]
  }
  if (_deg < 270) {
    return [0, halfHeight + halfWidth * Math.tan(degToRad(90 - (_deg % 180)))]
  }
  if (_deg === 270) {
    return [0, halfHeight]
  }
  if (_deg < 360 - diagonalDeg) {
    return [0, halfHeight - halfWidth * Math.tan(degToRad(_deg - 270))]
  }
  if (_deg === 360 - diagonalDeg) {
    return [0, 0]
  }
  if (_deg < 360) {
    return [halfWidth - halfHeight * Math.tan(degToRad(360 - _deg)), 0]
  }
}
