import * as THREE from 'three'
import { XYZ } from './types'

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
