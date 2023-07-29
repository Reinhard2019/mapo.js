import * as THREE from 'three'
import { LngLat, MapOptions, TileBox, XYZ } from './types'
import TileCache from './utils/TileCache'
import TileGeometry from './TileGeometry'
import CanvasLayerMaterial from './CanvasLayerMaterial'
import EarthOrbitControls from './EarthOrbitControls'
import Map from './Map'
import { formatTileXOrY, lngLatToVector3 } from './utils/map'
import TerrainTileWorker from './TerrainTileWorker'
import MercatorTile from './utils/MercatorTile'
import { isEqual, min, max } from 'lodash-es'
import TileMesh from './TileMesh'
import { toArray } from './utils/array'
import TileMaterial from './TileMaterial'
import CanvasLayerManager from './layers/CanvasLayerManager'
import { fullBBox } from './utils/bbox'
import { inRange } from './utils/number'

class TileGroup extends THREE.Group {
  private readonly map: Map
  private readonly earthOrbitControls: EarthOrbitControls
  readonly canvasLayerManager = new CanvasLayerManager()
  private canvasLayerMaterials: Record<string, CanvasLayerMaterial> = {}
  private readonly tileMeshCache = new TileCache<TileMesh>()
  private readonly tileCache = new TileCache<ImageBitmap | Promise<ImageBitmap>>()
  private readonly terrainTileWorker = new TerrainTileWorker()
  private readonly terrain: MapOptions['terrain']
  private prevTileBox: TileBox
  declare children: TileMesh[]

  constructor(options: {
    map: Map
    earthOrbitControls: EarthOrbitControls
    terrain: MapOptions['terrain']
  }) {
    super()

    this.earthOrbitControls = options.earthOrbitControls
    this.map = options.map
    this.terrain = options.terrain

    this.canvasLayerManager.onUpdate = () => {
      // TODO object 类型转化为数组不能保证顺序
      Object.keys(this.canvasLayerMaterials)
        .map(v => Number(v))
        .sort((a, b) => b - a)
        .forEach((k, i) => {
          const material = this.canvasLayerMaterials[k]
          material.update({
            bbox: this.canvasLayerManager.extraLayerOptions[i].bbox,
            canvas: this.canvasLayerManager.canvasArr[i],
          })
        })
    }

    this.update()
  }

  update() {
    const { tileCache } = this
    const { displayBBox, earthRadius, tileSize } = this.map
    const z = this.earthOrbitControls.z
    const tileBox = MercatorTile.bboxToTileBox(displayBBox, z)

    // TODO 主要的 TileMaterial 需要实时更新

    if (isEqual(tileBox, this.prevTileBox)) return
    this.prevTileBox = tileBox

    const childrenMap = new TileCache<true>()
    this.canvasLayerMaterials = {}
    const extraLayerOptions: typeof this.canvasLayerManager.extraLayerOptions = []

    const zToTileIndexDict: Record<number, Array<[number, number]>> = {}
    for (let y = tileBox.startY; y < tileBox.endY; y++) {
      for (let _x = tileBox.startX; _x < tileBox.endX; _x++) {
        const x = formatTileXOrY(_x, z)
        const xyz: XYZ = [x, y, z]

        const bbox = MercatorTile.tileToBBox(xyz)
        const center = [(bbox[2] + bbox[0]) / 2, (bbox[3] + bbox[1]) / 2] as LngLat
        const distance = this.earthOrbitControls.camera.position.distanceTo(
          lngLatToVector3(center, earthRadius),
        )
        const zoom = this.earthOrbitControls.distanceToZoom(distance + earthRadius)
        const _z = Math.ceil(zoom)
        if (zToTileIndexDict[_z]) {
          zToTileIndexDict[_z].push([_x, y])
        } else {
          zToTileIndexDict[_z] = [[_x, y]]
        }
      }
    }

    let prevZTileBox: TileBox
    Object.keys(zToTileIndexDict)
      .map(v => Number(v))
      .sort((a, b) => b - a)
      .forEach(_z => {
        const arr = zToTileIndexDict[_z]
        const gapZ2 = Math.pow(2, z - _z)
        const zTileBox: TileBox = {
          startX: Math.floor(min(arr.map(([x]) => x))! / gapZ2),
          startY: Math.floor(min(arr.map(([_, y]) => y))! / gapZ2),
          endX: Math.ceil(((max(arr.map(([x]) => x)) as number) + 1) / gapZ2),
          endY: Math.ceil(((max(arr.map(([_, y]) => y)) as number) + 1) / gapZ2),
        }
        if (zTileBox.startX % 2 === 1) {
          zTileBox.startX -= 1
        }
        if (zTileBox.startY % 2 === 1) {
          zTileBox.startY -= 1
        }
        if (zTileBox.endX % 2 === 1) {
          zTileBox.endX += 1
        }
        if (zTileBox.endY % 2 === 1) {
          zTileBox.endY += 1
        }

        this.canvasLayerMaterials[_z] = new CanvasLayerMaterial({
          canvas: new OffscreenCanvas(1, 1),
          bbox: fullBBox,
        })

        //  高程的 z 比正常的 z 缩小 3 倍
        const scaleZ = 3
        const terrainZ = Math.max(0, _z - scaleZ)
        const scaleZ2 = Math.pow(2, _z - terrainZ)
        const getTerrainTileIndex = (tileIndex: number) => Math.floor(tileIndex / scaleZ2)

        for (let y = zTileBox.startY; y < zTileBox.endY; y++) {
          for (let _x = zTileBox.startX; _x < zTileBox.endX; _x++) {
            if (
              prevZTileBox &&
              inRange(_x, prevZTileBox.startX, prevZTileBox.endX) &&
              inRange(y, prevZTileBox.startY, prevZTileBox.endY)
            ) {
              continue
            }
            const x = formatTileXOrY(_x, _z)
            const xyz: XYZ = [x, y, _z]
            childrenMap.set(xyz, true)

            let mesh = this.tileMeshCache.get(xyz)
            if (!mesh) {
              const tileGeometry = new TileGeometry({
                tileGroup: this,
                xyz,
                terrainXYZ: [getTerrainTileIndex(x), getTerrainTileIndex(y), terrainZ],
                earthRadius,
                tileSize,
              })
              mesh = new TileMesh(tileGeometry, [
                this.canvasLayerMaterials[_z],
                new TileMaterial({ xyz, tileCache, tileSize }),
              ])
              this.tileMeshCache.set(xyz, mesh)
            }

            this.add(mesh)
          }
        }

        prevZTileBox = {
          startX: zTileBox.startX / 2,
          startY: zTileBox.startY / 2,
          endX: zTileBox.endX / 2,
          endY: zTileBox.endY / 2,
        }

        extraLayerOptions.push({
          z: _z,
          bbox: MercatorTile.tileBoxToBBox(zTileBox, _z),
          pxDeg: 360 / (Math.pow(2, Number(_z)) * tileSize),
        })

        const { terrain } = this
        if (!terrain) return

        const terrainTileBox = MercatorTile.bboxToTileBox(displayBBox, terrainZ)
        for (let terrainY = terrainTileBox.startY; terrainY < terrainTileBox.endY; terrainY++) {
          for (
            let _terrainX = terrainTileBox.startX;
            _terrainX < terrainTileBox.endX;
            _terrainX++
          ) {
            const terrainX = formatTileXOrY(_terrainX, terrainZ)

            const terrainXYZ: XYZ = [terrainX, terrainY, terrainZ]
            void this.terrainTileWorker.loadTile({ xyz: terrainXYZ, tileSize }).then(imageData => {
              const updateTerrain = (xyz: XYZ) => {
                const geometry = this.getTileGeometry(xyz)
                if (geometry) {
                  geometry.updateTerrain(
                    imageData,
                    typeof terrain === 'object' ? terrain.exaggeration : 1,
                  )
                }
              }

              if (terrainX === 0) {
                for (let zi = 0; zi <= 3; zi++) {
                  const z2 = Math.pow(2, zi)
                  for (let yi = 0; yi < z2; yi++) {
                    for (let xi = 0; xi < z2; xi++) {
                      updateTerrain([xi, yi, zi])
                    }
                  }
                }
                return
              }

              const startX = terrainX * scaleZ2
              const endX = startX + scaleZ2
              const startY = terrainY * scaleZ2
              const endY = startY + scaleZ2
              for (let yi = startY; yi < endY; yi++) {
                for (let xi = startX; xi < endX; xi++) {
                  updateTerrain([xi, yi, _z])
                }
              }
            })
          }
        }
      })

    this.children = this.children.filter(child => childrenMap.has(child.geometry.xyz))
    console.log('extraLayerOptions', extraLayerOptions, displayBBox, tileBox)

    this.canvasLayerManager.extraLayerOptions = extraLayerOptions
    this.canvasLayerManager.updateLayers()
    this.canvasLayerManager.update()
  }

  getTileMesh(xyz: XYZ | undefined) {
    if (!xyz) return

    return this.tileMeshCache.get(xyz)
  }

  getTileGeometry(xyz: XYZ | undefined) {
    return this.getTileMesh(xyz)?.geometry
  }

  dispose() {
    this.terrainTileWorker.terminate()
    this.tileMeshCache.toArray().forEach(mesh => {
      mesh.geometry.dispose()
      toArray(mesh.material).forEach(m => m.dispose())
    })
  }
}

export default TileGroup
