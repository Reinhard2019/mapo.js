import { expect, test } from 'vitest'
import { chunk, multiplyArray, sortByAverage } from './array'

test('multiply()', () => {
  expect(multiplyArray([1, 2], [3, 4])).toStrictEqual([
    [1, 3],
    [1, 4],
    [2, 3],
    [2, 4]
  ])
  expect(multiplyArray([1, 2], [3, 4], true)).toStrictEqual([
    [1, 3],
    [2, 3],
    [1, 4],
    [2, 4]
  ])
})

test('sortByAverage()', () => {
  expect(sortByAverage([1, 2, 3, 4, 5])).toStrictEqual([3, 2, 4, 1, 5])
  expect(sortByAverage([1, 2, 3, 4])).toStrictEqual([2, 3, 1, 4])
})

test('chunk()', () => {
  expect(chunk([1, 2, 3, 4, 5], 3)).toStrictEqual([[1, 2, 3], [4, 5]])
})
