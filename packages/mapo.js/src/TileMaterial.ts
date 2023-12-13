import * as THREE from 'three'
import { XYZ } from './types'
import MercatorTile from './utils/MercatorTile'
import { getSatelliteUrl } from './utils/map'

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
uniform bool loaded;
uniform vec3 xyz;

${lngToX}

${latToY}

void main() {
  float uvY = vUv.y;
  if (xyz.z <= 15.0) {
    uvY = 1.0 - (latToY(vLngLat.y, xyz.z) - xyz.y);
  }
  if (loaded) {
    gl_FragColor = texture2D(canvasTexture, vec2(vUv.x, uvY));
  } else {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
}
`

const openDebugUI = true
function addDebugUI(texture: THREE.Texture, xyz: XYZ): THREE.Texture {
  if (!openDebugUI) return texture

  const img = texture.image
  const canvas = new OffscreenCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D

  const rect = [0, 0, canvas.width, canvas.height] as const

  ctx.drawImage(img, ...rect)

  ctx.strokeStyle = 'red'
  ctx.lineWidth = 1
  ctx.strokeRect(...rect)

  ctx.font = '50px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'red'
  ctx.fillText(xyz.toString(), canvas.width / 2, canvas.height / 2)
  return new THREE.CanvasTexture(canvas)
}

class TileMaterial extends THREE.ShaderMaterial {
  private readonly xyz: XYZ
  private loadPromise?: Promise<THREE.Texture> | undefined

  constructor(options: { xyz: XYZ }) {
    const { xyz } = options

    super({
      uniforms: {
        xyz: {
          value: xyz,
        },
        canvasTexture: {
          value: null,
        },
        loaded: {
          value: false,
        },
      },
      vertexShader,
      fragmentShader,
    })

    this.xyz = xyz
    void this.load()
  }

  async load() {
    if (!this.loadPromise) {
      const { xyz } = this
      const url = getSatelliteUrl(xyz)
      this.loadPromise = new THREE.TextureLoader().loadAsync(url)

      this.loadPromise
        .then(texture => {
          this.uniforms.canvasTexture.value = addDebugUI(texture, xyz)
          this.uniforms.loaded.value = true
        })
        .catch(() => {
          delete this.loadPromise
        })
    }
    return await this.loadPromise
  }

  dispose() {
    this.uniforms.canvasTexture.value?.dispose()
    super.dispose()
  }
}

export default TileMaterial
