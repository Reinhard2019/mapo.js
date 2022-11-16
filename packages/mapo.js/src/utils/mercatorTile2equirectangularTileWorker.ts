function mercatorTile2equirectangularTile (e: {
  data: {
    imageData: ImageData
    tileSize: number
    xyz: number[]
    mercatorYRange: number[]
  }
}) {
  function chunk<T> (arr: ArrayLike<T>, count: number) {
    const res: T[][] = []
    for (let i = 0; i < arr.length; i++) {
      const index = Math.floor(i / count)
      if (Array.isArray(res[index])) {
        res[index].push(arr[i])
      } else {
        res[index] = [arr[i]]
      }
    }
    return res
  }

  function mercatorTile2lat (y: number, z: number) {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z)
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
  }

  function equirectangularTile2lat (y: number, tileSize: number) {
    return 90 - (180 / tileSize) * y
  }

  const maxLat = (Math.atan(Math.sinh(Math.PI)) * 180) / Math.PI

  const { imageData, tileSize, xyz, mercatorYRange } = e.data
  const [_x, y, z] = xyz

  const pixelList = chunk<number>(imageData.data, 4)
  const linePixelList = chunk(pixelList, tileSize)
  const mercatorLatArr = Array(linePixelList.length)
    .fill(0)
    .map((_, pointY) => mercatorTile2lat(mercatorYRange[0] + pointY / tileSize, z))

  const n = equirectangularTile2lat(y, Math.pow(2, z))
  const s = equirectangularTile2lat(y + 1, Math.pow(2, z))
  const latGap = (n - s) / tileSize

  /**
   * 将 mercator 投影转化为 equirectangular 投影
   * 两者的唯一区别在于 lat
   */
  const equirectangularLinePixelList = Array(tileSize)
    .fill(0)
    .map((_, pointY) => {
      const lat = n - pointY * latGap

      if (lat > maxLat) {
        return linePixelList[0]
      }
      if (lat < -maxLat) {
        return linePixelList[linePixelList.length - 1]
      }
      const i = mercatorLatArr.findIndex((v) => v < lat)
      if (i === -1) {
        return linePixelList[linePixelList.length - 1]
      }
      return linePixelList[i - 1]
    })
    .map((value) => value.flatMap((v) => [v, v]))

  self.postMessage(
    new Uint8ClampedArray(equirectangularLinePixelList.flat().flat().flat())
  )
}

const blob = new Blob([
  `self.addEventListener('message', ${mercatorTile2equirectangularTile.toString()}, false);`
])

const mercatorTile2equirectangularTileWorkerUrl = URL.createObjectURL(blob)

export default mercatorTile2equirectangularTileWorkerUrl
