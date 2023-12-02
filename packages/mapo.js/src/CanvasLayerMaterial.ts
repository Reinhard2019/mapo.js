import * as THREE from 'three'
import { BBox } from './types'
import { fullBBox } from './utils/bbox'

interface CanvasOption {
  bbox: BBox
  width: number
  height: number
}

const vertexShader = `
  varying vec2 vUv;
  varying vec2 vLngLat;
  uniform vec4 bbox;
  attribute vec2 lngLat;

  vec2 lngLat2uv(vec2 lngLat) {
    float gW = bbox[0];
    float gE = bbox[2];
    float lng = lngLat.x;
    if (gW < -180.0) {
      float formattedGW = 360.0 + gW;
      if (lng >= formattedGW) {
        lng -= 360.0;
      } else if (lng < formattedGW && lng > gE) {
        // 消除误差，取距离最近的 w 或 e
        lng = abs(lng - gE) > abs(formattedGW - lng) ? gE : formattedGW;
      }
    }
    if (gE > 180.0) {
      float formattedGE = gE - 360.0;
      if (lng <= formattedGE) {
        lng += 360.0;
      } else if (lng > formattedGE && lng < gW) {
        // 消除误差，取距离最近的 w 或 e
        lng = abs(lng - gW) > abs(formattedGE - lng) ? gW : formattedGE;
      }
    }

    float w = bbox[0];
    float s = bbox[1];
    float e = bbox[2];
    float n = bbox[3];
    return vec2((lng - w) / (e - w), (lngLat.y - s) / (n - s));
  }

  void main() {
    vUv = lngLat2uv(lngLat);
    vLngLat = lngLat;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const fragmentShader = `
  uniform sampler2D canvasTexture;
  uniform bool hasPrevBBox;
  uniform vec4 prevBBox;
  varying vec2 vUv;
  varying vec2 vLngLat;

  bool belongPrevBBox() {
    if (!hasPrevBBox) {
      return false;
    }

    float w = prevBBox[0];
    float s = prevBBox[1];
    float e = prevBBox[2];
    float n = prevBBox[3];

    return (vLngLat.x >= w && vLngLat.x < e && vLngLat.y >= s && vLngLat.y < n);
  }

  void main() {
    if (!belongPrevBBox() && vUv.x >= 0.0 && vUv.x <= 1.0 && vUv.y >= 0.0 && vUv.y <= 1.0) {
      gl_FragColor = texture2D(canvasTexture, vUv);
    }
  }
`

class CanvasLayerMaterial extends THREE.ShaderMaterial {
  readonly canvas: OffscreenCanvas
  readonly ctx: OffscreenCanvasRenderingContext2D
  private bbox: BBox

  constructor(
    options: CanvasOption = {
      width: 1,
      height: 1,
      bbox: fullBBox,
    },
  ) {
    const canvas = new OffscreenCanvas(options.width, options.height)
    const uniforms = {
      canvasTexture: { value: new THREE.CanvasTexture(canvas) },
      bbox: { value: options.bbox },
      /**
       * 过滤掉 prevBBox 的区域
       */
      prevBBox: { value: options.bbox },
      hasPrevBBox: { value: false },
    }

    super({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
    })

    this.canvas = canvas
    this.ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
    this.bbox = options.bbox
  }

  updatePrevBBox(value: BBox | undefined) {
    if (value) {
      this.uniforms.prevBBox.value = value
    }
    this.uniforms.hasPrevBBox.value = !!value
  }

  updateCanvasOption(options: CanvasOption) {
    this.bbox = options.bbox

    this.canvas.width = options.width
    this.canvas.height = options.height
  }

  update() {
    this.uniforms.bbox.value = this.bbox

    this.uniforms.canvasTexture.value.dispose()
    this.uniforms.canvasTexture.value = new THREE.CanvasTexture(this.canvas)
  }

  dispose() {
    this.uniforms.canvasTexture.value.dispose()
    super.dispose()
  }
}

export default CanvasLayerMaterial
