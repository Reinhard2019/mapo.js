import { radToDeg } from 'three/src/math/MathUtils'
import { expect, test } from 'vitest'
import { rectangleIntersect } from './math'

test('rectangleIntersect()', () => {
  const width = 20
  const height = 10
  const diagonalDeg = radToDeg(Math.atan(width / height))

  expect(rectangleIntersect(width, height, 0)).toStrictEqual([10, 0])
  expect(rectangleIntersect(width, height, 360)).toStrictEqual([10, 0])
  expect(rectangleIntersect(width, height, 30)).toMatchInlineSnapshot(`
    [
      12.886751345948129,
      0,
    ]
  `)
  expect(rectangleIntersect(width, height, diagonalDeg)).toStrictEqual([20, 0])
  expect(rectangleIntersect(width, height, 80)).toMatchInlineSnapshot(`
    [
      20,
      3.23673019291535,
    ]
  `)
  expect(rectangleIntersect(width, height, 90)).toStrictEqual([20, 5])
  expect(rectangleIntersect(width, height, 110)).toMatchInlineSnapshot(`
    [
      20,
      8.639702342662023,
    ]
  `)
  expect(rectangleIntersect(width, height, 180 - diagonalDeg)).toStrictEqual([20, 10])
  expect(rectangleIntersect(width, height, 160)).toMatchInlineSnapshot(`
    [
      11.819851171331011,
      10,
    ]
  `)
  expect(rectangleIntersect(width, height, 180)).toStrictEqual([10, 10])
  expect(rectangleIntersect(width, height, 210)).toMatchInlineSnapshot(`
    [
      7.113248654051871,
      10,
    ]
  `)
  expect(rectangleIntersect(width, height, 180 + diagonalDeg)).toStrictEqual([0, 10])
  expect(rectangleIntersect(width, height, 260)).toMatchInlineSnapshot(`
    [
      0,
      6.76326980708465,
    ]
  `)
  expect(rectangleIntersect(width, height, 270)).toStrictEqual([0, 5])
  expect(rectangleIntersect(width, height, 280)).toMatchInlineSnapshot(`
    [
      0,
      3.23673019291535,
    ]
  `)
  expect(rectangleIntersect(width, height, 360 - diagonalDeg)).toStrictEqual([0, 0])
  expect(rectangleIntersect(width, height, 350)).toMatchInlineSnapshot(`
    [
      9.118365096457675,
      0,
    ]
  `)
})
