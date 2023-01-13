import { expect, test } from 'vitest'
import {
  decimalFraction
} from './number'

test('decimalFraction()', () => {
  expect(decimalFraction(-1.5)).toBe(-0.5)
  expect(decimalFraction(1.5)).toBe(0.5)
})
