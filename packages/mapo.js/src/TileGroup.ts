import * as THREE from 'three'
import { MapOptions, TileBox, XYZ } from './types'
import TileCache from './utils/TileCache'
import TileGeometry from './TileGeometry'
import TileMaterials from './TileMaterials'
import EarthOrbitControls from './EarthOrbitControls'
import Map from './Map'
import { formatTileXOrY } from './utils/map'
import TerrainTileWorker from './TerrainTileWorker'
import MercatorTile from './utils/MercatorTile'
import { isEqual } from 'lodash-es'

class TileGroup extends THREE.Group {
  private readonly map: Map
  private readonly earthOrbitControls: EarthOrbitControls
  readonly tileMaterials: TileMaterials
  private readonly tileCache = new TileCache<THREE.Mesh<TileGeometry>>()
  private readonly terrainTileWorker = new TerrainTileWorker()
  private readonly terrain: MapOptions['terrain']
  private prevTileBox: TileBox
  declare children: Array<THREE.Mesh<TileGeometry>>

  constructor(options: {
    map: Map
    earthOrbitControls: EarthOrbitControls
    terrain: MapOptions['terrain']
  }) {
    super()

    this.earthOrbitControls = options.earthOrbitControls
    this.map = options.map
    this.terrain = options.terrain

    this.tileMaterials = new TileMaterials(options)

    this.update()
  }

  update() {
    const { displayBBox, earthRadius, tileSize } = this.map
    const z = this.earthOrbitControls.z
    const tileBox = MercatorTile.bboxToTileBox(displayBBox, z)

    this.tileMaterials.tileGeometryBBox = MercatorTile.tileBoxToBBox(tileBox, z)
    this.tileMaterials.update()

    if (isEqual(tileBox, this.prevTileBox)) return
    this.prevTileBox = tileBox

    //  高程的 z 比正常的 z 缩小 3 倍
    const scaleZ = 3
    const terrainZ = Math.max(0, z - scaleZ)
    const scaleZ2 = Math.pow(2, z - terrainZ)
    const getTerrainTileIndex = (tileIndex: number) => Math.floor(tileIndex / scaleZ2)

    const childrenMap = new TileCache<true>()
    for (let y = tileBox.startY; y < tileBox.endY; y++) {
      for (let _x = tileBox.startX; _x < tileBox.endX; _x++) {
        const x = formatTileXOrY(_x, z)
        const xyz: XYZ = [x, y, z]
        childrenMap.set(xyz, true)

        let mesh = this.tileCache.get(xyz)
        if (!mesh) {
          const tileGeometry = new TileGeometry({
            tileGroup: this,
            xyz,
            terrainXYZ: [getTerrainTileIndex(x), getTerrainTileIndex(y), terrainZ],
            earthRadius,
            tileSize,
          })
          this.tileMaterials.materials.forEach((_, i) => {
            tileGeometry.addGroup(0, Infinity, i)
          })
          mesh = new THREE.Mesh(tileGeometry, this.tileMaterials.materials)
          this.tileCache.set(xyz, mesh)
        }

        this.add(mesh)
      }
    }
    this.children = this.children.filter(child => childrenMap.has(child.geometry.xyz))

    const { terrain } = this
    if (!terrain) return

    const terrainTileBox = MercatorTile.bboxToTileBox(displayBBox, terrainZ)
    for (let terrainY = terrainTileBox.startY; terrainY < terrainTileBox.endY; terrainY++) {
      for (let _terrainX = terrainTileBox.startX; _terrainX < terrainTileBox.endX; _terrainX++) {
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
              updateTerrain([xi, yi, z])
            }
          }
        })
      }
    }
  }

  getTileMesh(xyz: XYZ | undefined) {
    if (!xyz) return

    return this.tileCache.get(xyz)
  }

  getTileGeometry(xyz: XYZ | undefined) {
    return this.getTileMesh(xyz)?.geometry
  }

  dispose() {
    this.tileMaterials.dispose()
    this.terrainTileWorker.terminate()
    this.tileCache.toArray().forEach(mesh => mesh.geometry.dispose())
  }
}

export default TileGroup
