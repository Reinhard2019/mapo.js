import * as THREE from 'three'
import { BBox } from './types'

const vertexShader = `
  varying vec2 vUv;
  uniform vec4 bbox;

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
    vUv = lngLat2uv(uv);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const fragmentShader = `
  uniform sampler2D canvasTexture;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(canvasTexture, vUv);
    // gl_FragColor = vec4(255.0, 255.0, 255.0, 1.0);
  }
`

class CanvasLayerMaterial extends THREE.ShaderMaterial {
  constructor(options: { canvas: OffscreenCanvas; bbox: BBox }) {
    // const layerManager = new CanvasLayerManager()
    // const getTexture = () => new THREE.CanvasTexture(layerManager.canvasArr[0])
    const uniforms = {
      canvasTexture: { value: new THREE.CanvasTexture(options.canvas) },
      bbox: { value: options.bbox },
    }

    super({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
    })

    // this.canvasLayerManager = layerManager
  }

  update(options: { canvas: OffscreenCanvas; bbox: BBox }) {
    this.uniforms.bbox.value = options.bbox

    this.uniforms.canvasTexture.value.dispose()
    this.uniforms.canvasTexture.value = new THREE.CanvasTexture(options.canvas)
  }
}

export default CanvasLayerMaterial
