import { expect, test } from 'vitest'
import MercatorTile from './MercatorTile'

test('MercatorTile.pointToTile()', () => {
  const z = 5
  const z2 = Math.pow(2, z)
  expect(MercatorTile.latToY(MercatorTile.maxLat, z)).toBe(0)
  expect(MercatorTile.latToY(-MercatorTile.maxLat, z)).toEqual(z2)
  expect(MercatorTile.latToY(90, z)).toEqual(0)
  expect(MercatorTile.latToY(-90, z)).toEqual(z2)
})

test('MercatorTile.bboxToTileIndexBox()', () => {
  expect(MercatorTile.bboxToTileIndexBox([-90, -90, 90, 90], 0)).toEqual({
    startX: 0,
    startY: 0,
    endX: 1,
    endY: 1,
  })
})
