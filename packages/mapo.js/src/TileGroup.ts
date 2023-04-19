import * as THREE from 'three'
import { XYZ } from './types'
import EquirectangularTile from './utils/EquirectangularTile'
import TileCache from './utils/TileCache'
import { range } from 'lodash-es'
import TileGeometry from './TileGeometry'
import TileMaterials from './TileMaterials'
import EarthOrbitControls from './EarthOrbitControls'
import Map from './Map'
import { formatTileX } from './utils/map'

class TileGroup extends THREE.Group {
  private readonly map: Map
  private readonly earthOrbitControls: EarthOrbitControls
  readonly tileMaterials: TileMaterials
  private readonly cache = new TileCache<THREE.Mesh>()

  constructor(options: { map: Map; earthOrbitControls: EarthOrbitControls }) {
    super()

    this.earthOrbitControls = options.earthOrbitControls
    this.map = options.map

    this.tileMaterials = new TileMaterials(options)

    this.update()
  }

  update() {
    const { displayBBox: bbox, earthRadius, tileSize } = this.map
    const z = this.earthOrbitControls.z
    const tileBox = EquirectangularTile.bboxToTileBox(bbox, z)

    const tileMap: Record<string, true> = {}
    range(tileBox.startY, tileBox.endY).forEach(y => {
      range(tileBox.startX, tileBox.endX).forEach(x => {
        const xyz: XYZ = [formatTileX(x, z), y, z]
        tileMap[xyz.toString()] = true

        let mesh = this.cache.get(xyz)
        if (!mesh) {
          const tileGeometry = new TileGeometry({ xyz, earthRadius, tileSize })
          this.tileMaterials.materials.forEach((_, i) => {
            tileGeometry.addGroup(0, Infinity, i)
          })
          mesh = new THREE.Mesh(tileGeometry, this.tileMaterials.materials)
          mesh.userData.xyz = xyz
          this.cache.set(xyz, mesh)
        }

        this.add(mesh)
      })
    })

    this.children = this.children.filter(child => tileMap[child.userData.xyz.toString()])

    this.tileMaterials.tileGeometryBBox = EquirectangularTile.tileBoxToBBox(tileBox, z)
    this.tileMaterials.update()
  }

  dispose() {
    this.tileMaterials.dispose()
    this.cache.toArray().forEach(mesh => mesh.geometry.dispose())
  }
}

export default TileGroup
