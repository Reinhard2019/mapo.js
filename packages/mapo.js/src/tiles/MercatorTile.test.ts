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
  // const z = 0
  // expect(MercatorTile.bboxToTileIndexBox([-90, -90, 90, 90], z)).toEqual({
  //   startX: 0,
  //   startY: 0,
  //   endX: 1,
  //   endY: 1,
  // })

  console.log(MercatorTile.bboxToTileIndexBox([
    -63.594714999999994,
    -50.095011,
    296.405285,
    90
  ], 1))
})
