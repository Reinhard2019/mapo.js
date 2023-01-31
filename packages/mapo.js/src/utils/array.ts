import { sum } from 'lodash-es'
import { ID } from '../types'

/**
 * eg. multiplyArray([1, 2], [3, 4]) = [[1, 3], [1, 4], [2, 3], [2, 4]]
 * @param xArray
 * @param yArray
 * @param row 是否按行来排列
 * @returns
 */
export function multiplyArray<T1, T2> (xArray: T1[], yArray: T2[], row?: boolean) {
  const arr: Array<[T1, T2]> = []
  if (row) {
    for (const y of yArray) {
      for (const x of xArray) {
        arr.push([x, y])
      }
    }
  } else {
    for (const x of xArray) {
      for (const y of yArray) {
        arr.push([x, y])
      }
    }
  }
  return arr
}

/**
 * 如果传入一个非数组字段，则将其转化为数组
 * @param value
 * @returns
 */
export function inflate<T> (value: T | T[]) {
  return Array.isArray(value) ? value : [value]
}

/**
 * 根据平均数排序，离平均数越近越前
 * @param arr
 * @returns
 */
export function sortByAverage (arr: number[]) {
  const total = sum(arr)
  const average = total / arr.length
  return arr.sort((v1, v2) => {
    return Math.abs(v1 - average) - Math.abs(v2 - average)
  })
}

/**
 * !!! 会用于 Web Worker
 * @param array
 * @param size
 * @returns
 */
export function slice<T> (array: ArrayLike<T>, start: number, end?: number) {
  let length = array == null ? 0 : array.length
  if (!length) {
    return []
  }
  start = start == null ? 0 : start
  end = end === undefined ? length : end

  if (start < 0) {
    start = -start > length ? 0 : (length + start)
  }
  end = end > length ? length : end
  if (end < 0) {
    end += length
  }
  length = start > end ? 0 : ((end - start) >>> 0)
  start >>>= 0

  let index = -1
  const result = new Array(length)
  while (++index < length) {
    result[index] = array[index + start]
  }
  return result
}

/**
 * !!! 会用于 Web Worker
 * @param array
 * @param size
 * @returns
 */
export function chunk<T> (array: ArrayLike<T>, size: number) {
  const result = new Array(Math.ceil(array.length / size))
  for (let i = 0; i < result.length; i++) {
    result[i] = slice(array, i * size, (i + 1) * size)
  }
  return result
}

/**
 * !!! 会用于 Web Worker
 * @param arr
 * @returns
 */
export function last<T> (arr: T[]) {
  return arr[arr.length - 1]
}

/**
 * !!! 会用于 Web Worker
 * @param arr
 * @returns
 */
export function keyBy<T> (arr: T[], iteratee: (v: T) => ID) {
  return Object.fromEntries(arr.map(v => [iteratee(v), v]))
}
