import { isEmpty, last } from 'lodash-es'
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
 * 根据两点求出垂线过第三点的直线的交点
 * @param {THREE.Vector2} point - 垂线上的点，包含 x 和 y 属性
 * @param {THREE.Vector2} linePoint1 - 直线上的第一个点，包含 x 和 y 属性
 * @param {THREE.Vector2} linePoint2 - 直线上的第二个点，包含 x 和 y 属性
 * @returns {THREE.Vector2} - 返回点到直线的垂直交点坐标，包含 x 和 y 属性
 */
export function perpendicularIntersection(
  point: THREE.Vector2,
  linePoint1: THREE.Vector2,
  linePoint2: THREE.Vector2,
) {
  const A = (linePoint1.y - linePoint2.y) / (linePoint1.x - linePoint2.x)
  const B = linePoint1.y - A * linePoint1.x
  const m = point.x + A * point.y

  const ptCross = new THREE.Vector2()
  ptCross.x = (m - A * B) / (A * A + 1)
  ptCross.y = A * ptCross.x + B

  return ptCross
}

/**
 * 已知某点一定位于给定线段延伸的直线上，判断某点位于给定线段的前、中、后
 * @param {THREE.Vector2} point - 要检查的点，包含 x 和 y 属性
 * @param {THREE.Vector2} segmentStart - 线段起点，包含 x 和 y 属性
 * @param {THREE.Vector2} segmentEnd - 线段终点，包含 x 和 y 属性
 * @returns {'front' | 'center' | 'back'} - 前 中 后
 */
export function pointPositionToSegment(
  point: THREE.Vector2,
  segmentStart: THREE.Vector2,
  segmentEnd: THREE.Vector2,
): 'front' | 'center' | 'back' {
  if (segmentStart.x > segmentEnd.x) {
    if (point.x > segmentStart.x) {
      return 'front'
    } else if (point.x < segmentEnd.x) {
      return 'back'
    } else {
      return 'center'
    }
  } else if (segmentStart.x < segmentEnd.x) {
    if (point.x < segmentStart.x) {
      return 'front'
    } else if (point.x > segmentEnd.x) {
      return 'back'
    } else {
      return 'center'
    }
  }

  if (segmentStart.y > segmentEnd.y) {
    if (point.y > segmentStart.y) {
      return 'front'
    } else if (point.y < segmentEnd.y) {
      return 'back'
    } else {
      return 'center'
    }
  } else if (segmentStart.y < segmentEnd.y) {
    if (point.y < segmentStart.y) {
      return 'front'
    } else if (point.y > segmentEnd.y) {
      return 'back'
    } else {
      return 'center'
    }
  }

  return 'center'
}

/**
 * 从线段起始点开始，沿着线寻找给定距离的点
 * @param segmentStart
 * @param segmentEnd
 * @param distance
 * @returns
 */
export function getPointOnSegment(
  segmentStart: THREE.Vector2,
  segmentEnd: THREE.Vector2,
  distance: number,
): THREE.Vector2 {
  const angle = Math.atan((segmentEnd.y - segmentStart.y) / (segmentEnd.x - segmentStart.x))
  const d = segmentEnd.x - segmentStart.x > 0 ? distance : -distance
  return new THREE.Vector2(
    segmentStart.x + Math.cos(angle) * d,
    segmentStart.y + Math.sin(angle) * d,
  )
}

/**
 * 根据某一线段信息获取折线上的某个点
 * @param line
 * @param segmentInfo
 * @returns
 */
export function getPointBySegmentInfo(
  line: THREE.Vector2[],
  segmentInfo: {
    index: number
    distance: number
  },
) {
  if (segmentInfo.index === line.length - 1) {
    const segmentStart = line[segmentInfo.index - 1]
    const segmentEnd = line[segmentInfo.index]
    return getPointOnSegment(
      segmentStart,
      segmentEnd,
      segmentStart.distanceTo(segmentEnd) + segmentInfo.distance,
    )
  }
  const segmentStart = line[segmentInfo.index]
  const segmentEnd = line[segmentInfo.index + 1]
  return getPointOnSegment(segmentStart, segmentEnd, segmentInfo.distance)
}

/**
 * 以线段起始点为原点，+x 轴为 0 度，沿逆时针方向求线段角度
 * @param segmentStart
 * @param segmentEnd
 * @returns
 */
export function getAngle(segmentStart: THREE.Vector2, segmentEnd: THREE.Vector2) {
  const angle = Math.atan((segmentEnd.y - segmentStart.y) / (segmentEnd.x - segmentStart.x))

  // 顺时针
  // if (segmentEnd.x - segmentStart.x >= 0) {
  //   return degToRad(90) - angle
  // } else {
  //   return degToRad(270) - angle
  // }

  if (segmentEnd.y - segmentStart.y >= 0) {
    if (segmentEnd.x - segmentStart.x >= 0) {
      return angle
    } else {
      return degToRad(180) + angle
    }
  } else {
    if (segmentEnd.x - segmentStart.x >= 0) {
      return degToRad(360) + angle
    } else {
      return degToRad(180) + angle
    }
  }
}

/**
 * 获取线段外某点在某线段上在给定距离上的交叉点，如果存在两个点，则优先获取离线段起始点最近的点
 * @param outsidePoint 线段外某点
 * @param segmentStart
 * @param segmentEnd
 * @param distance
 * @returns {THREE.Vector2}
 */
export function getClosestCrossPointOnSegment(
  outsidePoint: THREE.Vector2,
  segmentStart: THREE.Vector2,
  segmentEnd: THREE.Vector2,
  distance: number,
): THREE.Vector2 {
  const perpendicularIntersectionPoint = perpendicularIntersection(
    outsidePoint,
    segmentStart,
    segmentEnd,
  )
  const d = Math.sqrt(
    Math.pow(distance, 2) - Math.pow(outsidePoint.distanceTo(perpendicularIntersectionPoint), 2),
  )
  const angle = Math.atan((segmentEnd.y - segmentStart.y) / (segmentEnd.x - segmentStart.x))
  const point1 = new THREE.Vector2(
    perpendicularIntersectionPoint.x + Math.cos(angle) * d,
    perpendicularIntersectionPoint.y + Math.sin(angle) * d,
  )
  const point2 = new THREE.Vector2(
    perpendicularIntersectionPoint.x + Math.cos(angle) * -d,
    perpendicularIntersectionPoint.y + Math.sin(angle) * -d,
  )
  let point: THREE.Vector2
  if (pointPositionToSegment(point1, segmentStart, segmentEnd) !== 'center') {
    point = point2
  } else if (pointPositionToSegment(point2, segmentStart, segmentEnd) !== 'center') {
    point = point1
  } else {
    point = segmentStart.distanceTo(point1) <= segmentStart.distanceTo(point2) ? point1 : point2
  }
  return point
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

/**
 * 如果邻近的两个点小于 gap，删除掉后一个点
 * @param line
 * @param gap
 */
export function cleanLine(line: THREE.Vector2[], gap: number) {
  const newLine: THREE.Vector2[] = []
  line.forEach(point => {
    const prevPoint = last(newLine)
    if (!prevPoint) {
      newLine.push(point)
      return
    }

    if (point.distanceTo(prevPoint) >= gap) {
      newLine.push(point)
    }
  })
  return newLine
}

/**
 * 根据距离获取折线上某个线段的索引以及剩余的距离
 * @param line
 * @param distance
 * @returns
 */
export function getClosestSegmentInfo(
  line: THREE.Vector2[],
  distance: number,
): {
  index: number
  /** 剩余的距离 */
  distance: number
} {
  const index = line.findIndex((p, i) => {
    if (i === line.length - 1) return true

    const next = line[i + 1]
    const d = p.distanceTo(next)
    if (distance < d) {
      return true
    }

    distance -= d
    return false
  })
  return {
    index,
    distance,
  }
}

/**
 * 根据距离获取折线上某个线段的索引以及剩余的距离，该距离为和起始点的直线距离
 * @param line
 * @param distance
 * @returns
 */
export function getClosestCrossSegmentIndex(line: THREE.Vector2[], distance: number): number {
  if (distance <= 0 || isEmpty(line)) return 0

  const start = line[0]
  const index = line.slice(1).findIndex(p => {
    const d = start.distanceTo(p)
    return distance < d
  })
  return index === -1 ? line.length - 1 : index
}
