/**
 * eg. multiply([1, 2], [3, 4]) = [[1, 3], [1, 4], [2, 3], [2, 4]]
 * @param arr1
 * @param arr2
 * @returns
 */
export function multiply<T1, T2> (arr1: T1[], arr2: T2[]) {
  const arr: Array<[T1, T2]> = []
  for (const v1 of arr1) {
    for (const v2 of arr2) {
      arr.push([v1, v2])
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
