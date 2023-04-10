import * as THREE from 'three'
import { fullBBox } from './utils/bbox'
import MercatorTile from './utils/MercatorTile'
import TileLayer from './layers/TileLayer'
import LayerManager from './layers/LayerManager'
import EarthOrbitControls from './EarthOrbitControls'
import Map from './Map'
import EquirectangularTile from './utils/EquirectangularTile'
import { BBox } from './types'

class TileMaterials {
  readonly materials: THREE.ShaderMaterial[] = []
  readonly tileLayer: TileLayer
  readonly layerManager: LayerManager
  private readonly map: Map
  private readonly earthOrbitControls: EarthOrbitControls

  constructor(options: { map: Map; earthOrbitControls: EarthOrbitControls }) {
    this.map = options.map
    this.earthOrbitControls = options.earthOrbitControls

    const { tileSize } = options.map

    const backgroundMaterial = new THREE.ShaderMaterial({
      fragmentShader: `
        void main() {
          gl_FragColor = vec4(0, 0, 0, 1);
        }
      `,
    })
    this.materials.push(backgroundMaterial)

    const vertexShader = `
      varying vec2 vUv;
      uniform vec4 bbox;

      float radToDeg(float rad) {
        return rad * 180.0 / ${Math.PI};
      }
      vec2 vec3ToLngLat(vec3 position) {
        float radius = distance(position, vec3(0,0,0));
        if (radius == 0.0) {
          return vec2(0, 0);
        }
        float lng = radToDeg(atan(position.x, position.z));
        float lat = 90.0 - radToDeg(acos(clamp(position.y / radius, -1.0, 1.0)));
        return vec2(lng, lat);
      }
      vec2 lngLat2uv(vec2 lngLat) {
        float w = bbox[0];
        float s = bbox[1];
        float e = bbox[2];
        float n = bbox[3];
        float lng = lngLat.x;
        if (lng < w) {
          lng += 360.0;
        } else if (lng > e) {
          lng -= 360.0;
        }
        return vec2((lng - w) / (e - w), (lngLat.y - s) / (n - s));
      }

      void main() {
        vUv = lngLat2uv(vec3ToLngLat(position));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `

    // 创建 tileMaterial
    {
      const tileLayer = new TileLayer(tileSize)
      this.tileLayer = tileLayer
      const getTexture = () => new THREE.CanvasTexture(tileLayer.canvas)
      tileLayer.onUpdate = () => {
        uniforms.bbox.value = tileLayer.bbox
        uniforms.canvasBBox.value = tileLayer.canvasBBox
        uniforms.startCanvasY.value = MercatorTile.latToY(tileLayer.canvasBBox[1], 0)
        uniforms.endCanvasY.value = MercatorTile.latToY(tileLayer.canvasBBox[3], 0)
        uniforms.tile.value.dispose()
        uniforms.tile.value = getTexture()
      }
      const uniforms = {
        tile: { value: getTexture() },
        bbox: { value: fullBBox },
        canvasBBox: { value: fullBBox },
        startCanvasY: { value: MercatorTile.latToY(fullBBox[1], 0) },
        endCanvasY: { value: MercatorTile.latToY(fullBBox[3], 0) },
      }
      // 将 lat(纬度) 转化为墨卡托投影中的 y(0-1)
      const latToY = `
        float latToY(float lat) {
          if (lat >= ${MercatorTile.maxLat}) {
            return 0.0;
          }
          if (lat <= ${-MercatorTile.maxLat}) {
            return 1.0;
          }

          float sinValue = sin(radians(lat));
          float y = (0.5 - (0.25 * log((1.0 + sinValue) / (1.0 - sinValue))) / ${Math.PI});
          return y;
        }
      `
      const fragmentShader = `
        uniform sampler2D tile;
        uniform sampler2D layers;
        uniform vec4 bbox;
        uniform vec4 canvasBBox;
        uniform float startCanvasY;
        uniform float endCanvasY;
        varying vec2 vUv;

        ${latToY}

        void main() {
          float w = bbox[0];
          float s = bbox[1];
          float e = bbox[2];
          float n = bbox[3];
          float canvasW = canvasBBox[0];
          float canvasS = canvasBBox[1];
          float canvasE = canvasBBox[2];
          float canvasN = canvasBBox[3];

          float canvasLatGap = canvasE - canvasW;
          float scaleX = (e - w) / canvasLatGap;
          float startX = (w - canvasW) / canvasLatGap;
          float x = vUv.x * scaleX + startX;

          float lat = s + vUv.y * (n - s);
          float y = (latToY(lat) - startCanvasY) / (endCanvasY - startCanvasY);

          vec2 uv = vec2(x, y);
          gl_FragColor = texture2D(tile, uv);
        }
      `
      const tileMaterial = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
      })
      this.materials.push(tileMaterial)
    }

    // 创建 layersMaterial
    {
      const layerManager = new LayerManager()
      this.layerManager = layerManager
      const getTexture = () => new THREE.CanvasTexture(layerManager.canvas)
      layerManager.onUpdate = () => {
        uniforms.bbox.value = layerManager.bbox
        uniforms.layers.value.dispose()
        uniforms.layers.value = getTexture()
      }
      const uniforms = {
        layers: { value: getTexture() },
        bbox: { value: fullBBox },
      }
      const layersMaterial = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader: `
          uniform sampler2D layers;
          varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(layers, vUv);
          }
        `,
        transparent: true,
      })
      this.materials.push(layersMaterial)
    }
  }

  update() {
    const z = this.earthOrbitControls.z
    const tileIndexBox = EquirectangularTile.bboxToTileIndexBox(this.map.displayBBox, z)
    const bbox: BBox = [
      EquirectangularTile.xToLng(tileIndexBox.startX, z),
      EquirectangularTile.yToLat(tileIndexBox.endY, z),
      EquirectangularTile.xToLng(tileIndexBox.endX, z),
      EquirectangularTile.yToLat(tileIndexBox.startY, z),
    ]

    this.tileLayer.bbox = bbox
    this.tileLayer.displayBBox = bbox
    this.tileLayer.z = z
    this.tileLayer.refresh()

    this.layerManager.bbox = bbox
    this.layerManager.displayBBox = bbox
    this.layerManager.z = z
    this.layerManager.updateCanvasSize(this.earthOrbitControls.getPxDeg())
    this.layerManager.refresh()
  }

  dispose() {
    this.layerManager.dispose()
  }
}

export default TileMaterials
