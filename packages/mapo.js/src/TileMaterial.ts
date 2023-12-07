import * as THREE from 'three'
import { XYZ } from './types'
import MercatorTile from './utils/MercatorTile'

const vertexShader = `
varying vec2 vUv;
varying vec2 vLngLat;
attribute vec2 lngLat;

void main() {
  vUv = uv;
  vLngLat = lngLat;
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
// TODO 精度问题，zoom 大于 15 时使用 lngToX 计算 uv 时会开始模糊，暂时直接使用 vUv.y
const fragmentShader = `
varying vec2 vUv;
varying vec2 vLngLat;
uniform sampler2D canvasTexture;
uniform vec3 xyz;

${lngToX}

${latToY}

void main() {
  float uvY = vUv.y;
  if (xyz.z <= 15.0) {
    uvY = 1.0 - (latToY(vLngLat.y, xyz.z) - xyz.y);
  }
  gl_FragColor = texture2D(canvasTexture, vec2(vUv.x, uvY));
}
`

const openDebugUI = false
function addDebugUI(ctx: OffscreenCanvasRenderingContext2D, xyz: XYZ, tileSize: number) {
  if (!openDebugUI) return

  const rect = [0, 0, tileSize, tileSize] as const

  ctx.strokeStyle = 'red'
  ctx.lineWidth = 1
  ctx.strokeRect(...rect)

  ctx.font = '50px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'red'
  ctx.fillText(xyz.toString(), tileSize / 2, tileSize / 2)
}

class TileMaterial extends THREE.ShaderMaterial {
  constructor(options: { xyz: XYZ; tileSize: number; image: CanvasImageSource }) {
    const { xyz, tileSize, image } = options

    const canvas = new OffscreenCanvas(tileSize, tileSize)
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D

    ctx.drawImage(image, 0, 0, tileSize, tileSize)

    addDebugUI(ctx, xyz, tileSize)

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
  }

  dispose() {
    this.uniforms.canvasTexture.value.dispose()
    super.dispose()
  }
}

export default TileMaterial
