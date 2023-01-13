import { expect, test } from 'vitest'
import {
  getDisplayCentralAngle,
  // getDisplayArcLength
} from './map'

test('getCentralAngle()', () => {
  const r = 1
  expect(getDisplayCentralAngle(1, r, 60)).toBe(0)
  expect(getDisplayCentralAngle(1.5, r, 60)).toBe(37.18075578145829)
  expect(getDisplayCentralAngle(2, r, 60)).toBe(120.00000000000001)
  expect(getDisplayCentralAngle(3, r, 60)).toBe(141.05755873101862)
  expect(getDisplayCentralAngle(4, r, 60)).toBe(151.04497562814015)
})

// test('getDisplayArcLength()', () => {
//   const r = 1
//   expect(getDisplayArcLength(1, r, 60)).toBe(0)
//   expect(getDisplayArcLength(1.5, r, 60)).toBe(0.6489266067663644)
//   expect(getDisplayArcLength(2, r, 60)).toBe(2.0943951023931957)
//   expect(getDisplayArcLength(3, r, 60)).toBe(2.4619188346815495)
//   expect(getDisplayArcLength(4, r, 60)).toBe(2.636232143305636)
// })
