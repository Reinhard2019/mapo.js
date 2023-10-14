import { expect, test } from 'vitest'
import { fract, inRange } from './number'

test('decimalFraction()', () => {
  expect(fract(-1.5)).toBe(-0.5)
  expect(fract(1.5)).toBe(0.5)
})

test('inRange()', () => {
  expect(inRange(1, 1, 2)).toBeTruthy()
  expect(inRange(1.9, 1, 2)).toBeTruthy()
  expect(inRange(2, 1, 2)).toBeFalsy()
})
