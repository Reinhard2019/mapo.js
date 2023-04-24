import { Feature, FeatureCollection, Geometry } from 'geojson'
import type { WebGLRendererParameters, Event } from 'three'

export interface MapOptions extends CameraOptions {
  container: string | HTMLElement
  hash?: boolean
  webGLRendererParameters?: WebGLRendererParameters
  /**
   * 是否开启地形
   */
  terrain?:
    | boolean
    | {
        exaggeration: number
      }
  /**
   * 服务器端渲染
   */
  ssr?: boolean
}

export type CameraEventType =
  | 'zoomstart'
  | 'zoom'
  | 'zoomend'
  | 'rotatestart'
  | 'rotate'
  | 'rotateend'
  | 'movestart'
  | 'move'
  | 'moveend'
  | 'pitchstart'
  | 'pitch'
  | 'pitchend'

export interface CameraEvent extends Event {
  type: CameraEventType
}

export interface MapEvent extends Event {
  type: 'render' | 'click' | CameraEventType
}

export interface CameraOptions {
  center?: LngLat
  zoom?: number
  bearing?: number
  pitch?: number
}

export interface AnimationOptions {
  duration?: number | undefined
}

export interface EarthOrbitControlsOptions extends CameraOptions {
  domElement?: HTMLElement
  earthRadius: number
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
export interface TileBox {
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
