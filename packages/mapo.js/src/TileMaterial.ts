import * as THREE from 'three'
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
const fragmentShader = `
varying vec2 vUv;
uniform sampler2D canvasTexture;
void main() {
  gl_FragColor = texture2D(canvasTexture, vUv);
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

    this.load = () => {
      const promise = new Promise<ImageBitmap>(resolve => {
        new THREE.ImageBitmapLoader().load(
          getSatelliteUrl(...xyz),
          image => {
            tileCache.set(xyz, image)

            const rect = [0, 0, tileSize, tileSize] as const
            ctx.clearRect(...rect)
            ctx.drawImage(image, ...rect)

            addDebugUI(ctx, xyz, tileSize)

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
