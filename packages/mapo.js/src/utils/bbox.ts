import { isEqual } from 'lodash-es'
import { BBox } from '../types'

export const fullBBox: BBox = [-180, -90, 180, 90]

/**
 * 前者的边界是否完全包括了后者
 * @param parent
 * @param child
 * @returns
 */
export function contains (parent: BBox, child: BBox) {
  return parent[0] <= child[0] && parent[1] <= child[1] && parent[2] >= child[2] && parent[3] >= child[3]
}

export function scale (bbox: BBox, scaleValue: number): BBox {
  const [w, s, e, n] = bbox
  const lngGap = e - w
  const latGap = n - s

  const translateLng = (scaleValue - 1) / 2 * lngGap
  const translateLat = (scaleValue - 1) / 2 * latGap
  return [w - translateLng, s - translateLat, e + translateLng, n + translateLat]
}

/**
 * 在球体显示时，对纬度超过[90, -90]范围进行处理
 * @param bbox
 * @returns
 */
export function latPretreatmentBBox (bbox: BBox): BBox {
  let [w, s, e, n] = bbox

  if (n - s > 180) {
    return fullBBox
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

export function isFull (bbox: BBox): boolean {
  return isEqual(bbox, fullBBox)
}
