/**
 * 把一个值限制在一个上限和下限之间
 */
export function clamp (min: number, num: number, max: number) {
  return Math.min(Math.max(num, min), max)
}
