import { XYZ } from '../../types'

type TileValue = ImageBitmap | Promise<ImageBitmap>

class TileCache {
  data: Record<string, TileValue> = {}

  private getKey (xyz: XYZ) {
    return xyz.join('.')
  }

  has (xyz: XYZ) {
    return !!this.data[this.getKey(xyz)]
  }

  get (xyz: XYZ) {
    return this.data[this.getKey(xyz)]
  }

  set (xyz: XYZ, value: TileValue) {
    this.data[this.getKey(xyz)] = value
  }

  delete (xyz: XYZ) {
    delete this.data[this.getKey(xyz)]
  }
}

export default TileCache
