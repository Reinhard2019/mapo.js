/**
 * !!! 会用于 Web Worker
 * @param start
 * @param end
 * @returns
 */
export function range (start: number, end: number) {
  return Array(end - start).fill(0).map((_, i) => start + i)
}

/**
 * !!! 会用于 Web Worker
 */
export function isNil (value: any) {
  return value === undefined || value === null
}

export function ternaryOperation<T, F = undefined> (value: T, when: (v: T) => boolean, fallback?: F) {
  return when(value) ? value : fallback
}
