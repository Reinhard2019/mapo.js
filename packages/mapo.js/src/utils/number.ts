/**
 * 如果 num 不位于 range 内，则返回最接近的上边界或下边界，如果位于，则返回 num 本身
 * @param num
 * @param range
 * @returns
 */
export function closestInRange (num: number, range: [number, number]) {
  const min = range[0]
  const max = range[1]
  return Math.min(Math.max(num, min), max)
}
