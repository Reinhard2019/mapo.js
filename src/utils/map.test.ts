import * as d3 from 'd3';
import * as turf from '@turf/turf';
import { degToRad, radToDeg } from 'three/src/math/MathUtils';
import { expect, test } from 'vitest';
import {
  getDisplayCentralAngle,
  getDisplayArcLength,
  getSatelliteUrl,
  getZoom,
} from './map';
import mercatorTile from './mercatorTile';

// test('getZoom()', () => {
//   expect(getZoom(120)).toBe(1);
//   expect(getZoom(90)).toBe(1.5);
//   expect(getZoom(60)).toBe(2);
//   expect(getZoom(30)).toBe(3);
//   expect(getZoom(22.5)).toBe(3.5);
//   expect(getZoom(15)).toBe(4);
// });

test('getCentralAngle()', () => {
  const r = 1;
  expect(getDisplayCentralAngle(1, r, 60)).toBe(0);
  expect(getDisplayCentralAngle(1.5, r, 60)).toBe(37.18075578145829);
  expect(getDisplayCentralAngle(2, r, 60)).toBe(120.00000000000001);
  expect(getDisplayCentralAngle(3, r, 60)).toBe(141.05755873101862);
  expect(getDisplayCentralAngle(4, r, 60)).toBe(151.04497562814015);
});

test('getDisplayArcLength()', () => {
  const r = 1;
  expect(getDisplayArcLength(1, r, 60)).toBe(0);
  expect(getDisplayArcLength(1.5, r, 60)).toBe(0.6489266067663644);
  expect(getDisplayArcLength(2, r, 60)).toBe(2.0943951023931957);
  expect(getDisplayArcLength(3, r, 60)).toBe(2.4619188346815495);
  expect(getDisplayArcLength(4, r, 60)).toBe(2.636232143305636);
});

test.only('xxx', () => {
  const z = 2;
  const z2 = Math.pow(2, z);
  console.log(z2);
  const a = Array(z2)
    .fill(0)
    .map((_, i) => {
      return mercatorTile.yToLat(i, z);
    });
  console.log(a.join());
  const b = a.map((v, i) => {
    if (i === 0) {
      return v - a[i - 1];
      return 0;
    }
  });
  b.shift();
  // console.log(b.join());
  const c = Array(z2)
    .fill(0)
    .map((_, i) => {
      return 90 - (180 / z2) * i;
    });
  console.log(c.join());

  console.log(mercatorTile.latToY(90, 0));
  console.log(mercatorTile.latToY(-90, 0));
  
});
