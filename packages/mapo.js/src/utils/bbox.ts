import { isEqual } from 'lodash-es'
import { BBox } from '../types'
import { inRange } from './number'

export const fullBBox: BBox = [-180, -90, 180, 90]

/**
 * 前者的边界是否完全包括了后者
 * @param parent [start, end]
 * @param child [start, end]
 * @returns
 */
export function lineContain(parent: [number, number], child: [number, number]) {
  return parent[0] <= child[0] && parent[1] >= child[1]
}

/**
 * 前者的边界是否完全包括了后者
 * @param parent
 * @param child
 * @returns
 */
export function bboxContain(parent: BBox, child: BBox) {
  return (
    lineContain([parent[0], parent[2]], [child[0], child[2]]) &&
    lineContain([parent[1], parent[3]], [child[1], child[3]])
  )
}

/**
 * 两个 line 是否存在重叠部分
 * @param a [start, end]
 * @param b [start, end]
 * @returns
 */
export function lineOverlap(a: [number, number], b: [number, number]) {
  return !(b[0] >= a[1] || b[1] <= a[0])
}

/**
 * 两个 bbox 是否存在重叠部分
 * @param a
 * @param b
 * @returns
 */
export function bboxOverlap(a: BBox, b: BBox) {
  return lineOverlap([a[0], a[2]], [b[0], b[2]]) && lineOverlap([a[1], a[3]], [b[1], b[3]])
}

export function pointInBBox(point: [number, number], bbox: BBox) {
  return inRange(point[0], bbox[0], bbox[2]) && inRange(point[1], bbox[1], bbox[3])
}

export function scale(bbox: BBox, scaleValue: number): BBox {
  const [w, s, e, n] = bbox
  const lngGap = e - w
  const latGap = n - s

  const translateLng = ((scaleValue - 1) / 2) * lngGap
  const translateLat = ((scaleValue - 1) / 2) * latGap
  return [w - translateLng, s - translateLat, e + translateLng, n + translateLat]
}

/**
 * 在球体显示时，对纬度超过[90, -90]范围进行处理
 * @param bbox
 * @returns
 */
export function latPretreatmentBBox(bbox: BBox): BBox {
  let [w, s, e, n] = bbox

  if (n - s > 180) {
    return fullBBox
  }

  if (e - w > 360) {
    w = -180
    e = 180
  }

  const nGt90 = n > 90
  const sLtMinus90 = s < -90
  if (sLtMinus90 && nGt90) {
    w = -180
    e = 180
  }
  if (sLtMinus90) {
    n = Math.max(-180 - s, n)
    s = -90
  }
  if (nGt90) {
    s = Math.min(180 - n, s)
    n = 90
  }
  return [w, s, e, n]
}

export function isFull(bbox: BBox): boolean {
  return isEqual(bbox, fullBBox)
}
