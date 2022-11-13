import { degToRad } from 'three/src/math/MathUtils';
import { BBox, XYZ } from '../types';

const maxLat = Math.atan(Math.sinh(Math.PI)) * 180 / Math.PI;

// https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
const mercatorTile = {
  maxLat,

  pointToTile(lng: number, lat: number, z: number): XYZ {
    return [
      Math.floor(mercatorTile.lngToX(lng, z)),
      Math.floor(mercatorTile.latToY(lat, z)),
      z,
    ];
  },

  tileToBBOX(xyz: XYZ): BBox {
    const [x, y, z] = xyz;
    const e = mercatorTile.xToLng(x + 1, z);
    const w = mercatorTile.xToLng(x, z);
    const s = mercatorTile.yToLat(y + 1, z);
    const n = mercatorTile.yToLat(y, z);
    return [w, s, e, n];
  },

  lngToX(lng: number, z: number) {
    return ((lng + 180) / 360) * Math.pow(2, z);
  },

  xToLng(x: number, z: number) {
    return (360 / Math.pow(2, z)) * x - 180;
  },

  latToY(lat: number, z: number) {
    const sin = Math.sin(degToRad(lat));
    const z2 = Math.pow(2, z);
    let y = z2 * (0.5 - (0.25 * Math.log((1 + sin) / (1 - sin))) / Math.PI);
    if (y < 0) {
      return 0;
    }
    if (y > z2) {
      return z2;
    }
    return y;
  },

  yToLat(y: number, z: number) {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  },
} as const;

export default mercatorTile;
