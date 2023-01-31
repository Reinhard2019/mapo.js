import { expect, test } from 'vitest'
import {
  decimalFraction, inRange
} from './number'

test('decimalFraction()', () => {
  expect(decimalFraction(-1.5)).toBe(-0.5)
  expect(decimalFraction(1.5)).toBe(0.5)
})

test('inRange()', () => {
  expect(inRange(1, 1, 2)).toBeTruthy()
  expect(inRange(1.9, 1, 2)).toBeTruthy()
  expect(inRange(2, 1, 2)).toBeFalsy()
})
