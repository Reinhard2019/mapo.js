import { radToDeg } from 'three/src/math/MathUtils'
import { expect, test } from 'vitest'
import {
  getAngle,
  getClosestCrossSegmentIndex,
  getClosestSegmentInfo,
  getPointOnSegment,
  rectangleIntersect,
} from './math'
import * as THREE from 'three'

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

test('getCrossPointOnSegment()', () => {
  const p1 = getPointOnSegment(new THREE.Vector2(0, 0), new THREE.Vector2(5, 5), 1)
  expect(p1.x).toBeCloseTo(0.7, 1)
  expect(p1.y).toBeCloseTo(0.7, 1)

  const p2 = getPointOnSegment(new THREE.Vector2(5, 0), new THREE.Vector2(0, 5), 1)
  expect(p2.x).toBeCloseTo(4.3, 1)
  expect(p2.y).toBeCloseTo(0.7, 1)

  const p3 = getPointOnSegment(new THREE.Vector2(5, 5), new THREE.Vector2(0, 0), 1)
  expect(p3.x).toBeCloseTo(4.3, 1)
  expect(p3.y).toBeCloseTo(4.3, 1)

  const p4 = getPointOnSegment(new THREE.Vector2(0, 5), new THREE.Vector2(5, 0), 1)
  expect(p4.x).toBeCloseTo(0.7, 1)
  expect(p4.y).toBeCloseTo(4.3, 1)
})

test('getClosestSegmentIndex()', () => {
  const line = [new THREE.Vector2(0, 0), new THREE.Vector2(5, 0), new THREE.Vector2(5, 5)]

  expect(getClosestSegmentInfo(line, -1)).toEqual({ index: 0, distance: -1 })
  expect(getClosestSegmentInfo(line, 0)).toEqual({ index: 0, distance: 0 })
  expect(getClosestSegmentInfo(line, 7)).toEqual({ index: 1, distance: 2 })
  expect(getClosestSegmentInfo(line, 10)).toEqual({ index: 2, distance: 0 })
  expect(getClosestSegmentInfo(line, 12)).toEqual({ index: 2, distance: 2 })
})

test('getClosestCrossSegmentIndex()', () => {
  const line = [new THREE.Vector2(0, 0), new THREE.Vector2(5, 0), new THREE.Vector2(5, 5)]

  expect(getClosestCrossSegmentIndex(line, -1)).toBe(0)
  expect(getClosestCrossSegmentIndex(line, 0)).toBe(0)
  expect(getClosestCrossSegmentIndex(line, 4.9)).toBe(0)
  expect(getClosestCrossSegmentIndex(line, 5)).toBe(1)
  expect(getClosestCrossSegmentIndex(line, 7)).toBe(1)
  expect(getClosestCrossSegmentIndex(line, 7.5)).toBe(2)
})

test('getAngle()', () => {
  const angle = getAngle(new THREE.Vector2(0, 0), new THREE.Vector2(1, 0))
  expect(radToDeg(angle)).toBeCloseTo(0, 0)

  const angle2 = getAngle(new THREE.Vector2(0, 0), new THREE.Vector2(1, 2))
  expect(radToDeg(angle2)).toBeCloseTo(63, 0)

  const angle3 = getAngle(new THREE.Vector2(0, 0), new THREE.Vector2(0, 1))
  expect(radToDeg(angle3)).toBeCloseTo(90, 0)

  const angle4 = getAngle(new THREE.Vector2(0, 0), new THREE.Vector2(-1, 2))
  expect(radToDeg(angle4)).toBeCloseTo(180 - 63, 0)

  const angle5 = getAngle(new THREE.Vector2(0, 0), new THREE.Vector2(-1, 0))
  expect(radToDeg(angle5)).toBeCloseTo(180, 0)

  const angle6 = getAngle(new THREE.Vector2(0, 0), new THREE.Vector2(-1, -2))
  expect(radToDeg(angle6)).toBeCloseTo(180 + 63, 0)

  const angle7 = getAngle(new THREE.Vector2(0, 0), new THREE.Vector2(0, -5))
  expect(radToDeg(angle7)).toBeCloseTo(270, 0)

  const angle8 = getAngle(new THREE.Vector2(0, 0), new THREE.Vector2(1, -2))
  expect(radToDeg(angle8)).toBeCloseTo(360 - 63, 0)
})
