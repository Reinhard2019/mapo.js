import { LngLat, XYZ } from './types'
import MercatorTile from './utils/MercatorTile'
import TileCache from './utils/TileCache'
import { getTerrainUrl, rgb2elevation } from './utils/map'
import { degToRad } from './utils/math'

interface MessageEventData {
  earthRadius: number
  tileSize: number
  exaggeration: number
  terrainImageData: ImageData
  terrainXYZ: XYZ
  xyz: XYZ
}

export interface OnMessageEventData {
  positions: number[]
  uvs: number[]
  lngLats: number[]
  indexes: number[]
  widthPositionCount: number
}

function lngLatToVector3(lngLat: LngLat, radius: number) {
  const [lng, lat] = lngLat
  const phi = degToRad(90 - lat)
  const theta = degToRad(lng)

  const sinPhiRadius = Math.sin(phi) * radius

  const x = sinPhiRadius * Math.sin(theta)
  const y = Math.cos(phi) * radius
  const z = sinPhiRadius * Math.cos(theta)

  return [x, y, z]
}

export function getGeometryAttribute(
  _widthSegments: number,
  _heightSegments: number,
  xyz: XYZ,
  earthRadius: number,
  getTerrain?: (xi: number, yi: number) => number,
) {
  const [x, y, z] = xyz
  const _widthPositionCount = _widthSegments + 1
  const _heightPositionCount = _heightSegments + 1

  const positions: number[] = []
  const uvs: number[] = []
  const lngLats: number[] = []
  let extraWidthSegments = 0
  const addLine = (lat: number, _uvY: number, yi: number, isOrigin = false) => {
    extraWidthSegments = 0
    const uvY = 1 - _uvY

    // 添加裙边
    if (z !== 0) {
      const lng = MercatorTile.xToLng(x, z)
      positions.push(0, 0, 0)
      uvs.push(0, uvY)
      lngLats.push(lng, lat)
      extraWidthSegments++
    }

    for (let xi = 0; xi < _widthPositionCount; xi++) {
      const uvX = xi / _widthSegments
      const lng = MercatorTile.xToLng(x + uvX, z)
      const terrain = getTerrain ? getTerrain(xi, yi) : 0
      const position = isOrigin ? [0, 0, 0] : lngLatToVector3([lng, lat], earthRadius + terrain)
      positions.push(...position)
      uvs.push(uvX, uvY)
      lngLats.push(lng, lat)
    }

    // 添加裙边
    if (z !== 0) {
      const lng = MercatorTile.xToLng(x + 1, z)
      positions.push(0, 0, 0)
      uvs.push(1, uvY)
      lngLats.push(lng, lat)
      extraWidthSegments++
    }
  }

  let extraHeightSegments = 0
  // 添加裙边
  if (z !== 0) {
    const lat = y === 0 ? 90 : MercatorTile.yToLat(y, z)
    addLine(lat, 0, 0, true)
    extraHeightSegments++
  }
  if (y === 0) {
    addLine(90, 0, 0)
    extraHeightSegments++
  }
  for (let yi = 0; yi < _heightPositionCount; yi++) {
    const uvY = yi / _heightSegments
    const lat = MercatorTile.yToLat(y + uvY, z)
    addLine(lat, uvY, yi)
  }
  if (y === Math.pow(2, z) - 1) {
    addLine(-90, 1, _heightPositionCount)
    extraHeightSegments++
  }
  // 添加裙边
  if (z !== 0) {
    const lat = lngLats[lngLats.length - 1]
    addLine(lat, 1, _heightPositionCount, true)
    extraHeightSegments++
  }

  const widthSegments = _widthSegments + extraWidthSegments
  const heightSegments = _heightSegments + extraHeightSegments
  const widthPositionCount = widthSegments + 1
  const indexes: number[] = []
  for (let yi = 0; yi < heightSegments; yi++) {
    for (let xi = 0; xi < widthSegments; xi++) {
      const positionIndex1 = xi + yi * widthPositionCount
      const positionIndex2 = positionIndex1 + 1
      const positionIndex3 = positionIndex1 + widthPositionCount
      const positionIndex4 = positionIndex2 + widthPositionCount
      const face1 = [positionIndex1, positionIndex3, positionIndex2]
      const face2 = [positionIndex2, positionIndex3, positionIndex4]
      indexes.push(...face1, ...face2)
    }
  }

  return {
    positions,
    uvs,
    lngLats,
    indexes,
    widthPositionCount,
  }
}

function onmessage(event: MessageEvent<MessageEventData>) {
  const { earthRadius, tileSize, exaggeration, terrainImageData, terrainXYZ, xyz } = event.data
  const [x, y, z] = xyz
  const [, , terrainZ] = terrainXYZ
  const scaleZ2 = Math.pow(2, z - terrainZ)

  const data = terrainImageData.data
  const segments = tileSize / scaleZ2

  const startX = segments * (x % scaleZ2)
  const startY = segments * (y % scaleZ2)
  const getTerrain = (xi: number, yi: number) => {
    let elevation = 0
    const terrainXI = startX + xi
    const terrainYI = startY + yi
    if (terrainXI < tileSize && terrainYI < tileSize) {
      const sliceStart = (terrainYI * tileSize + terrainXI) * 4
      const color = data.slice(sliceStart, sliceStart + 4)
      elevation = (rgb2elevation(color) / 1000) * exaggeration
    }
    return elevation
  }

  const { positions, uvs, lngLats, indexes, widthPositionCount } = getGeometryAttribute(
    segments,
    segments,
    xyz,
    earthRadius,
    getTerrain,
  )

  postMessage({
    positions,
    uvs,
    lngLats,
    indexes,
    widthPositionCount,
  } as OnMessageEventData)
}

const scripts = [
  getTerrainUrl,
  rgb2elevation,
  ...MercatorTile.workerScripts,
  lngLatToVector3,
  degToRad,
  getGeometryAttribute,
]
const blob = new Blob([
  ...scripts.map(v => `${v.toString() as string}\n\n`).join(''),
  `onmessage = ${onmessage.toString()}`,
])

const workerUrl = URL.createObjectURL(blob)

class TileGeometryWorker extends Worker {
  cache = new TileCache()

  constructor() {
    super(workerUrl)
  }

  postMessage(message: MessageEventData, ...argus) {
    super.postMessage(message, ...argus)
  }
}

export default TileGeometryWorker
