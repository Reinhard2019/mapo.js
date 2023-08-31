import * as THREE from 'three'
import { LngLat, Terrain, XYZ } from './types'
import TileCache from './utils/TileCache'
import TileGeometry from './TileGeometry'
import EarthOrbitControls from './EarthOrbitControls'
import Map from './Map'
import { formatTileIndex, lngLatToVector3 } from './utils/map'
import TerrainTileWorker from './TerrainTileWorker'
import MercatorTile from './utils/MercatorTile'
import { isEmpty } from 'lodash-es'
import TileMesh from './TileMesh'
import { toArray } from './utils/array'
import TileMaterial from './TileMaterial'
import CanvasLayerManager from './layers/CanvasLayerManager'

class TileGroup extends THREE.Group {
  private readonly map: Map
  private readonly earthOrbitControls: EarthOrbitControls
  readonly canvasLayerManager: CanvasLayerManager = new CanvasLayerManager()
  private readonly tileMeshCache = new TileCache<TileMesh>()
  private readonly tileCache = new TileCache<ImageBitmap | Promise<ImageBitmap>>()
  private readonly terrainTileWorker
  private terrain: Terrain | undefined
  // private prevTileBox: TileBox
  declare children: TileMesh[]

  constructor(options: {
    map: Map
    earthOrbitControls: EarthOrbitControls
    terrain: Terrain | undefined
  }) {
    super()

    this.earthOrbitControls = options.earthOrbitControls
    this.map = options.map
    this.terrain = options.terrain
    this.terrainTileWorker = new TerrainTileWorker(this.map.tileSize)

    this.update()
  }

  setTerrain(terrain: Terrain) {
    this.terrain = terrain
    this.update()
  }

  update() {
    const { tileCache, earthOrbitControls } = this
    const { earthRadius, tileSize, displayBBox } = this.map
    const { center } = this.earthOrbitControls
    const totalTileBox = MercatorTile.bboxToTileBox(displayBBox, this.earthOrbitControls.z)

    // if (isEqual(totalTileBox, this.prevTileBox)) {
    //   return
    // }
    // this.prevTileBox = totalTileBox

    const getPxDeg = (z: number) =>
      360 / (Math.pow(2, z + (this.earthOrbitControls.zoom % 1)) * tileSize)

    const children: TileMesh[] = []
    const addTile = (_x: number, _y: number, z: number) => {
      const x = formatTileIndex(_x, z)
      const y = formatTileIndex(_y, z)
      const xyz: XYZ = [x, y, z]

      window.requestIdleCallback(() => {
        let mesh = this.tileMeshCache.get(xyz)
        if (!mesh) {
          const tileGeometry = new TileGeometry({
            tileGroup: this,
            xyz,
            terrainTileWorker: this.terrainTileWorker,
            earthRadius,
            tileSize,
          })
          mesh = new TileMesh(
            tileGeometry,
            new TileMaterial({ xyz, tileCache, tileSize }),
            this.canvasLayerManager,
          )
          this.tileMeshCache.set(xyz, mesh)
        }
        mesh.geometry.setTerrain(this.terrain)

        children.push(mesh)
      })
    }

    const tile = MercatorTile.pointToTile(center[0], center[1], this.earthOrbitControls.z)
    const [tileX, tileY] = tile
    addTile(tileX, tileY, this.earthOrbitControls.z)

    interface Around {
      top: number
      bottom: number
      left: number
      right: number
    }

    this.canvasLayerManager.resetCanvasOptionDict()

    const addAroundTiles = (
      around: Around & {
        disableTop?: boolean
        disableBottom?: boolean
        disableLeft?: boolean
        disableRight?: boolean
        /**
         * 顶点是否添加的计算逻辑
         * 默认为 &&
         */
        vertexLogic?: '||' | '&&'
      },
      z: number,
    ) => {
      const vertexLogic = around.vertexLogic ?? '&&'
      const z2Gap = Math.pow(2, earthOrbitControls.z - z)
      const hasLeftSide = !around.disableLeft && totalTileBox.startX <= around.left * z2Gap
      const hasRightSide = !around.disableRight && totalTileBox.endX > around.right * z2Gap
      const hasTopSide = !around.disableTop && totalTileBox.startY <= around.top * z2Gap
      const hasBottomSide = !around.disableBottom && totalTileBox.endY > around.bottom * z2Gap

      const tiles: Array<[number, number]> = []
      if (hasTopSide) {
        for (let x = around.left + 1; x < around.right; x++) {
          tiles.push([x, around.top])
        }
      }
      if (hasBottomSide) {
        for (let x = around.left + 1; x < around.right; x++) {
          tiles.push([x, around.bottom])
        }
      }
      if (hasLeftSide) {
        for (let y = around.top + 1; y < around.bottom; y++) {
          tiles.push([around.left, y])
        }
      }
      if (hasRightSide) {
        for (let y = around.top + 1; y < around.bottom; y++) {
          tiles.push([around.right, y])
        }
      }
      if (vertexLogic === '&&' ? hasLeftSide && hasTopSide : hasLeftSide || hasTopSide) {
        tiles.push([around.left, around.top])
      }
      if (vertexLogic === '&&' ? hasLeftSide && hasBottomSide : hasLeftSide || hasBottomSide) {
        tiles.push([around.left, around.bottom])
      }
      if (vertexLogic === '&&' ? hasRightSide && hasTopSide : hasRightSide || hasTopSide) {
        tiles.push([around.right, around.top])
      }
      if (vertexLogic === '&&' ? hasRightSide && hasBottomSide : hasRightSide || hasBottomSide) {
        tiles.push([around.right, around.bottom])
      }

      tiles.forEach(([x, y]) => addTile(x, y, z))
      return tiles
    }
    const addLoopAroundTiles = (around: Around, z: number) => {
      const tiles = addAroundTiles(around, z)

      if (isEmpty(tiles)) {
        this.canvasLayerManager.addCanvasBBox(z, {
          bbox: displayBBox,
          pxDeg: getPxDeg(z),
        })
        return
      }

      const lngLat: LngLat = [
        MercatorTile.xToLng(formatTileIndex(around.left, z), z),
        MercatorTile.yToLat(formatTileIndex(around.right, z), z),
      ]
      const distance = this.earthOrbitControls.camera.position.distanceTo(
        lngLatToVector3(lngLat, earthRadius),
      )
      const zoom = this.earthOrbitControls.distanceToZoom(distance + earthRadius)
      if (z - zoom < 2 || z === 0) {
        addLoopAroundTiles(
          {
            left: around.left - 1,
            top: around.top - 1,
            right: around.right + 1,
            bottom: around.bottom + 1,
          },
          z,
        )
        return
      }

      const left = around.left % 2 === 0 ? around.left : around.left - 1
      const top = around.top % 2 === 0 ? around.top : around.top - 1
      const right = around.right % 2 === 1 ? around.right : around.right + 1
      const bottom = around.bottom % 2 === 1 ? around.bottom : around.bottom + 1
      addAroundTiles(
        {
          left,
          top,
          right,
          bottom,
          disableLeft: left === around.left,
          disableRight: right === around.right,
          disableTop: top === around.top,
          disableBottom: bottom === around.bottom,
          vertexLogic: '||',
        },
        z,
      )

      this.canvasLayerManager.addCanvasBBox(z, {
        bbox: MercatorTile.tileBoxToBBox(
          {
            startX: left,
            startY: top,
            endX: right + 1,
            endY: bottom + 1,
          },
          z,
        ),
        pxDeg: getPxDeg(z),
      })

      addLoopAroundTiles(
        {
          left: left / 2 - 1,
          top: top / 2 - 1,
          right: (right + 1) / 2,
          bottom: (bottom + 1) / 2,
        },
        z - 1,
      )
    }
    if (this.earthOrbitControls.z > 0) {
      addLoopAroundTiles(
        {
          left: tileX - 1,
          top: tileY - 1,
          right: tileX + 1,
          bottom: tileY + 1,
        },
        this.earthOrbitControls.z,
      )
    }

    window.requestIdleCallback(() => {
      this.children = children
    })

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
