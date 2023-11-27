import { expect, test } from 'vitest'
import {
  getOverlapTileBox,
  getPrevZoomXYZ,
  isBelongXYZ,
  tileBoxContain,
  tileBoxOverlap,
  updateTileBoxZ,
  xyzToTileBox,
} from './tile'

test('xyzToTileBox()', () => {
  expect(xyzToTileBox([0, 0, 0])).toEqual({
    startX: 0,
    startY: 0,
    endX: 1,
    endY: 1,
    z: 0,
  })
})

test('updateTileBoxZ()', () => {
  expect(
    updateTileBoxZ(
      {
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 1,
        z: 0,
      },
      1,
    ),
  ).toEqual({
    startX: 0,
    startY: 0,
    endX: 2,
    endY: 2,
    z: 1,
  })

  expect(
    updateTileBoxZ(
      {
        startX: 0,
        startY: 0,
        endX: 2,
        endY: 2,
        z: 1,
      },
      0,
    ),
  ).toEqual({
    startX: 0,
    startY: 0,
    endX: 1,
    endY: 1,
    z: 0,
  })

  expect(
    updateTileBoxZ(
      {
        startX: 1,
        startY: 1,
        endX: 3,
        endY: 3,
        z: 2,
      },
      1,
    ),
  ).toEqual({
    startX: 0,
    startY: 0,
    endX: 2,
    endY: 2,
    z: 1,
  })
})

test('tileBoxContains()', () => {
  expect(
    tileBoxContain(
      {
        startX: 15,
        startY: 15,
        endX: 17,
        endY: 17,
        z: 5,
      },
      {
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 1,
        z: 1,
      },
    ),
  ).toBeFalsy()
})

test('tileBoxOverlap()', () => {
  expect(
    tileBoxOverlap(
      {
        startX: 1,
        startY: 1,
        endX: 2,
        endY: 2,
        z: 2,
      },
      {
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 1,
        z: 0,
      },
    ),
  ).toBeTruthy()
  expect(
    tileBoxOverlap(
      {
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 1,
        z: 0,
      },
      {
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 1,
        z: 0,
      },
    ),
  ).toBeTruthy()
  expect(
    tileBoxOverlap(
      {
        startX: -2,
        startY: 0,
        endX: 2,
        endY: 6,
        z: 3,
      },
      xyzToTileBox([3, 1, 2]),
    ),
  ).toBeTruthy()
  expect(
    tileBoxOverlap(xyzToTileBox([3, 2, 2]), {
      startX: -2,
      startY: 2,
      endX: 2,
      endY: 6,
      z: 3,
    }),
  ).toBeTruthy()
})

test('getOverlapTileBox()', () => {
  expect(getOverlapTileBox(xyzToTileBox([0, 0, 0]), xyzToTileBox([3, 2, 2]))).toEqual(
    xyzToTileBox([3, 2, 2]),
  )

  expect(getOverlapTileBox(xyzToTileBox([0, 0, 1]), xyzToTileBox([0, 1, 1]))).toBeNull()

  expect(
    getOverlapTileBox(xyzToTileBox([0, 0, 1]), {
      startX: 1,
      startY: 1,
      endX: 3,
      endY: 3,
      z: 2,
    }),
  ).toEqual({
    startX: 1,
    startY: 1,
    endX: 2,
    endY: 2,
    z: 2,
  })

  expect(
    getOverlapTileBox(xyzToTileBox([0, 0, 0]), {
      startX: 2,
      startY: 1,
      endX: 5,
      endY: 3,
      z: 2,
    }),
  ).toEqual({
    startX: 2,
    startY: 1,
    endX: 5,
    endY: 3,
    z: 2,
  })

  expect(
    getOverlapTileBox(xyzToTileBox([0, 0, 1]), {
      startX: 2,
      startY: 0,
      endX: 5,
      endY: 3,
      z: 2,
    }),
  ).toEqual({ startX: 0, endX: 1, startY: 0, endY: 2, z: 2 })
  expect(
    getOverlapTileBox(xyzToTileBox([0, 0, 1]), {
      startX: 1,
      startY: 0,
      endX: 4,
      endY: 3,
      z: 2,
    }),
  ).toEqual({ startX: 1, endX: 2, startY: 0, endY: 2, z: 2 })
})

test('isBelongXYZ()', () => {
  expect(isBelongXYZ([0, 0, 0], [0, 0, 0])).toBe(0)
  expect(isBelongXYZ([0, 0, 0], [0, 0, 1])).toBe(1)
  expect(isBelongXYZ([0, 0, 1], [0, 0, 0])).toBe(-1)

  expect(isBelongXYZ([0, 0, 1], [2, 2, 2])).toBe(0)
  expect(isBelongXYZ([0, 0, 1], [1, 1, 2])).toBe(1)
  expect(isBelongXYZ([1, 1, 2], [0, 0, 1])).toBe(-1)
})

test('getPrevZoomXYZ', () => {
  expect(getPrevZoomXYZ([0, 0, 0])).toBeUndefined()
  expect(getPrevZoomXYZ([3, 3, 2])).toEqual([1, 1, 1])
})
