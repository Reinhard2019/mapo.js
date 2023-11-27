import { expect, test } from 'vitest'
import { getDisplayCentralAngle, formatXYZ } from './map'

test('getCentralAngle()', () => {
  const r = 1
  expect(getDisplayCentralAngle(1, r, 60)).toBe(0)
  expect(getDisplayCentralAngle(1.5, r, 60)).toBe(37.18075578145825)
  expect(getDisplayCentralAngle(2, r, 60)).toBe(119.99999704244135)
  expect(getDisplayCentralAngle(3, r, 60)).toBe(141.05755873101862)
  expect(getDisplayCentralAngle(4, r, 60)).toBe(151.04497562814015)
})

test('formatXYZ()', () => {
  expect(formatXYZ([-1, 0, 2])).toEqual([3, 0, 2])
  expect(formatXYZ([1, 0, 2])).toEqual([1, 0, 2])
  expect(formatXYZ([4, 0, 2])).toEqual([0, 0, 2])
})
