import { expect, test } from 'vitest'
import { bboxOverlap, lineOverlap } from './bbox'

test('lineOverlap()', () => {
  expect(lineOverlap([0, 10], [10, 11])).toBe(false)
  expect(lineOverlap([0, 10], [1, 2])).toBe(true)
  expect(lineOverlap([0, 10], [1, 10])).toBe(true)
  expect(lineOverlap([0, 10], [1, 11])).toBe(true)
  expect(lineOverlap([0, 10], [-1, 11])).toBe(true)
  expect(lineOverlap([-1, 11], [0, 10])).toBe(true)
})

test('bboxOverlap()', () => {
  expect(bboxOverlap([0, 0, 10, 10], [1, 1, 4, 4])).toStrictEqual(true)
  expect(bboxOverlap([0, 0, 10, 10], [1, 1, 11, 11])).toStrictEqual(true)
  expect(bboxOverlap([0, 0, 10, 10], [-10, 5, 11, 10])).toStrictEqual(true)
  expect(bboxOverlap([0, 0, 10, 10], [10, 10, 11, 11])).toStrictEqual(false)
  expect(bboxOverlap([0, 0, 10, 10], [-10, -10, 0, 0])).toStrictEqual(false)
  expect(bboxOverlap([0, 0, 10, 10], [5, 15, 15, 15])).toStrictEqual(false)
})
