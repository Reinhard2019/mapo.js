import * as THREE from 'three'
import { fullBBox } from './utils/bbox'
import CanvasLayerManager from './layers/CanvasLayerManager'
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
  }
`

class CanvasLayerMaterial extends THREE.ShaderMaterial {
  readonly canvasLayerManager: CanvasLayerManager

  constructor() {
    const layerManager = new CanvasLayerManager()
    const getTexture = () => new THREE.CanvasTexture(layerManager.canvas)
    const uniforms = {
      canvasTexture: { value: getTexture() },
      bbox: { value: fullBBox },
    }
    layerManager.onUpdate = () => {
      uniforms.bbox.value = layerManager.bbox

      uniforms.canvasTexture.value.dispose()
      uniforms.canvasTexture.value = getTexture()
    }

    super({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
    })

    this.canvasLayerManager = layerManager
  }

  update(bbox: BBox, pxDeg: number) {
    this.canvasLayerManager.bbox = bbox
    this.canvasLayerManager.pxDeg = pxDeg
    this.canvasLayerManager.updateLayers()
  }
}

export default CanvasLayerMaterial
