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
  indexes: number[]
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

function onmessage(event: MessageEvent<MessageEventData>) {
  const { earthRadius, tileSize, exaggeration, terrainImageData, terrainXYZ, xyz } = event.data
  const [x, y, z] = xyz
  const [terrainX, terrainY, terrainZ] = terrainXYZ
  const scaleZ2 = Math.pow(2, z - terrainZ)

  const data = terrainImageData.data
  const segments = tileSize / scaleZ2
  const startX = segments * (x % scaleZ2)
  const startY = segments * (y % scaleZ2)
  const positionCount = segments + 1

  const positions: number[] = []
  for (let yi = startY; yi < startY + positionCount; yi++) {
    for (let xi = startX; xi < startX + positionCount; xi++) {
      const sliceStart = (yi * tileSize + xi) * 4
      let elevation = 0
      if (xi < tileSize && yi < tileSize) {
        const color = data.slice(sliceStart, sliceStart + 4)
        elevation = (rgb2elevation(color) / 1000) * exaggeration
      }

      const lng = MercatorTile.xToLng(terrainX + xi / tileSize, terrainZ)
      const lat = MercatorTile.yToLat(terrainY + yi / tileSize, terrainZ)
      const position = lngLatToVector3([lng, lat], earthRadius + elevation)
      positions.push(...position)
    }
  }

  const indexes: number[] = []
  for (let yi = 0; yi < segments; yi++) {
    for (let xi = 0; xi < segments; xi++) {
      const positionIndex1 = xi + yi * positionCount
      const positionIndex2 = positionIndex1 + 1
      const positionIndex3 = positionIndex1 + positionCount
      const positionIndex4 = positionIndex2 + positionCount
      const face1 = [positionIndex1, positionIndex3, positionIndex2]
      const face2 = [positionIndex2, positionIndex3, positionIndex4]
      indexes.push(...face1, ...face2)
    }
  }

  postMessage({
    positions,
    indexes,
  } as OnMessageEventData)
}

const scripts = [
  getTerrainUrl,
  rgb2elevation,
  ...MercatorTile.workerScripts,
  lngLatToVector3,
  degToRad,
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
