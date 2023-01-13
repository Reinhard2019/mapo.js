export interface MapOptions {
  container: string | HTMLElement
  center?: LngLat
  zoom?: number
}

export interface Size {
  width: number
  height: number
}

export type XYZ = [number, number, number]
export type BBox = [number, number, number, number]
export interface TileIndexBox {
  startX: number
  startY: number
  endX: number
  endY: number
}

export type LngLat = [number, number]

export type ID = number | string
