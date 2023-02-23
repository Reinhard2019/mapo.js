export interface MapOptions extends Pick<EarthOrbitControlsOptions, 'center' | 'zoom' | 'bearing'> {
  container: string | HTMLElement
  hash?: boolean
  /**
   * 是否开启帧数监视器
   */
  fps?: boolean
}

export interface EarthOrbitControlsOptions {
  domElement?: HTMLElement
  earthRadius: number
  center?: LngLat
  zoom?: number
  bearing?: number
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

export type PointLike = number[]

export type ID = number | string
