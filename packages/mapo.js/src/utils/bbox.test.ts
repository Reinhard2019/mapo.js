import { expect, test } from 'vitest'
import { bboxContain, bboxOverlap } from './bbox'

test('bboxContain()', () => {
  expect(bboxContain([0, 0, 10, 10], [1, 1, 4, 4])).toBeTruthy()
  expect(bboxContain([0, 0, 10, 10], [1, 1, 11, 11])).toBeFalsy()
})

test('bboxOverlap()', () => {
  expect(bboxOverlap([0, 0, 10, 10], [1, 1, 4, 4])).toStrictEqual(true)
  expect(bboxOverlap([0, 0, 10, 10], [1, 1, 11, 11])).toStrictEqual(true)
  expect(bboxOverlap([0, 0, 10, 10], [-10, 5, 11, 10])).toStrictEqual(true)
  expect(bboxOverlap([0, 0, 10, 10], [10, 10, 11, 11])).toStrictEqual(false)
  expect(bboxOverlap([0, 0, 10, 10], [-10, -10, 0, 0])).toStrictEqual(false)
  expect(bboxOverlap([0, 0, 10, 10], [5, 15, 15, 15])).toStrictEqual(false)
})
