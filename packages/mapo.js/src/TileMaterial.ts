import * as THREE from 'three'
import MercatorTile from './utils/MercatorTile'
import { XYZ } from './types'
import { drawPreviewImage } from './utils/canvas'
import { getSatelliteUrl } from './utils/map'
import TileCache from './utils/TileCache'

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const lngToX = `
float lngToX(float lng, float z) {
  return ((lng + 180.0) / 360.0) * pow(2.0, z);
}
`
// 将 lat(纬度) 转化为墨卡托投影中的 y
const latToY = `
float latToY(float lat, float z) {
  float z2 = pow(2.0, z);

  if (lat >= ${MercatorTile.maxLat}) {
    return 0.0;
  }
  if (lat <= ${-MercatorTile.maxLat}) {
    return z2;
  }

  float sinValue = sin(radians(lat));
  float y = z2 * (0.5 - (0.25 * log((1.0 + sinValue) / (1.0 - sinValue))) / ${Math.PI});
  return y;
}
`
const fragmentShader = `
varying vec2 vUv;
uniform sampler2D canvasTexture;
uniform vec3 xyz;

${lngToX}

${latToY}

void main() {
  vec2 uv = vec2(lngToX(vUv.x, xyz.z) - xyz.x, 1.0 - (latToY(vUv.y, xyz.z) - xyz.y));
  gl_FragColor = texture2D(canvasTexture, uv);
}
`

class TileMaterial extends THREE.ShaderMaterial {
  // 用于延迟加载
  load: () => void

  constructor(options: {
    xyz: XYZ
    tileSize: number
    tileCache: TileCache<ImageBitmap | Promise<ImageBitmap>>
  }) {
    const { xyz, tileSize, tileCache } = options

    const canvas = new OffscreenCanvas(tileSize, tileSize)
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D

    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, tileSize, tileSize)

    drawPreviewImage({
      ctx,
      xyz,
      tileSize,
      tileCache,
    })

    const texture = new THREE.CanvasTexture(canvas)

    super({
      uniforms: {
        xyz: {
          value: xyz,
        },
        canvasTexture: {
          value: texture,
        },
      },
      vertexShader,
      fragmentShader,
    })

    this.load = () => {
      const promise = new Promise<ImageBitmap>(resolve => {
        new THREE.ImageBitmapLoader().load(
          getSatelliteUrl(...xyz),
          image => {
            tileCache.set(xyz, image)

            const rect = [0, 0, tileSize, tileSize] as const
            ctx.clearRect(...rect)
            ctx.drawImage(image, ...rect)

            // ctx.strokeStyle = 'red'
            // ctx.lineWidth = 1
            // ctx.strokeRect(...rect)

            // ctx.font = '50px sans-serif'
            // ctx.textAlign = 'center'
            // ctx.textBaseline = 'middle'
            // ctx.fillStyle = 'red'
            // ctx.fillText(xyz.toString(), tileSize / 2, tileSize / 2)

            texture.needsUpdate = true
            resolve(image)
          },
          undefined,
          () => {
            tileCache.delete(xyz)
          },
        )
      })
      tileCache.set(xyz, promise)
    }
  }
}

export default TileMaterial
