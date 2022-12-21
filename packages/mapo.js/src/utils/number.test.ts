import { expect, test } from 'vitest'
import { clamp } from './number'

test('closestInRange()', () => {
  expect(clamp(1, 0.1, 2)).toEqual(1)
  expect(clamp(1, 2.1, 2)).toEqual(2)
  expect(clamp(1, 1.5, 2)).toEqual(1.5)
})
