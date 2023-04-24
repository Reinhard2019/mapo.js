import { XYZ } from '../types'

class TileCache<T> {
  private readonly data: Record<string, T> = {}

  private getKey(xyz: XYZ) {
    return xyz.toString()
  }

  has(xyz: XYZ) {
    return !!this.data[this.getKey(xyz)]
  }

  get(xyz: XYZ): T | undefined {
    return this.data[this.getKey(xyz)]
  }

  set(xyz: XYZ, value: T) {
    this.data[this.getKey(xyz)] = value
  }

  delete(xyz: XYZ) {
    delete this.data[this.getKey(xyz)]
  }

  toArray() {
    return Object.values(this.data)
  }
}

export default TileCache
