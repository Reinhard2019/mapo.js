import { Feature, FeatureCollection, Geometry } from 'geojson'
import type { WebGLRendererParameters } from 'three'

export interface MapOptions extends Pick<EarthOrbitControlsOptions, 'center' | 'zoom' | 'bearing'> {
  container: string | HTMLElement
  hash?: boolean
  webGLRendererParameters?: WebGLRendererParameters
  /**
   * 服务器端渲染
   */
  ssr?: boolean
}

export interface EarthOrbitControlsOptions {
  domElement?: HTMLElement
  earthRadius: number
  center?: LngLat
  zoom?: number
  bearing?: number
  pitch?: number
}

export interface Size {
  width: number
  height: number
}

export type XYZ = [number, number, number]
/**
 * [west, south, east, north]
 */
export type BBox = [number, number, number, number]
export interface TileIndexBox {
  startX: number
  startY: number
  endX: number
  endY: number
}

export type LngLat = [number, number]

export type Point2 = [number, number]
export type Point3 = [number, number, number]

export type ID = number | string

export type Features<G extends Geometry | null = Geometry> =
  | Feature<G>
  | Array<Feature<G>>
  | FeatureCollection<G>
