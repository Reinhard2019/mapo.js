import { expect, test } from 'vitest'
import { closestInRange } from './number'

test('closestInRange()', () => {
  expect(closestInRange(0.1, [1, 2])).toEqual(1)
  expect(closestInRange(2.1, [1, 2])).toEqual(2)
  expect(closestInRange(1.5, [1, 2])).toEqual(1.5)
})
