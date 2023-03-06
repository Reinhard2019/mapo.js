/**
 * 获取小数部分
 * @param num
 * @returns
 */
export function decimalFraction(num: number) {
  return num - Math.trunc(num)
}

/**
 * @param number
 * @param precision
 * @returns
 */
export function round(number: number, precision: number) {
  precision =
    precision == null ? 0 : precision >= 0 ? Math.min(precision, 292) : Math.max(precision, -292)
  if (precision) {
    // Shift with exponential notation to avoid floating-point issues.
    // See [MDN](https://mdn.io/round#Examples) for more details.
    let pair = `${number}e`.split('e')
    const value = Math.round(`${pair[0]}e${+pair[1] + precision}` as any)

    pair = `${value}e`.split('e')
    return +`${pair[0]}e${+pair[1] - precision}`
  }
  return Math.round(number)
}

/**
 * @param number
 * @param lower
 * @param upper
 * @returns
 */
export function clamp(number: number, lower: number, upper: number) {
  return Math.min(Math.max(number, lower), upper)
}

/**
 * @param number
 * @param start
 * @param end
 * @param boundary
 */
export function inRange(
  number: number,
  start: number,
  end: number,
  boundary: '()' | '[]' | '[)' | '(]' = '[)',
) {
  switch (boundary) {
    case '()':
      return number > start && number < end
    case '[]':
      return number >= start && number <= end
    case '[)':
      return number >= start && number < end
    case '(]':
      return number > start && number <= end
  }
}
