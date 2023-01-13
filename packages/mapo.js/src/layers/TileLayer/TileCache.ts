import { XYZ } from '../../types'

class TileCache {
  data: Record<string, ImageBitmap | Promise<ImageBitmap>> = {}

  private getKey (xyz: XYZ) {
    return xyz.join('.')
  }

  has (xyz: XYZ) {
    return !!this.data[this.getKey(xyz)]
  }

  get (xyz: XYZ) {
    return this.data[this.getKey(xyz)]
  }

  set (xyz: XYZ, value: ImageBitmap | Promise<ImageBitmap>) {
    this.data[this.getKey(xyz)] = value
  }

  delete (xyz: XYZ) {
    delete this.data[this.getKey(xyz)]
  }
}

export default TileCache
