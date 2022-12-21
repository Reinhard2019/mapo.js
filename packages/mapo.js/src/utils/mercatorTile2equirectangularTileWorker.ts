function mercatorTile2equirectangularTile (e: {
  data: {
    imageData: ImageData
    tileSize: number
    xyz: number[]
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

  const { imageData, tileSize, xyz } = e.data
  const [_x, y, z] = xyz

  const pixelList = chunk<number>(imageData.data, 4)
  const pixelLineList = chunk(pixelList, tileSize)
  const mercatorLatArr = Array(pixelLineList.length)
    .fill(0)
    .map((_, pointY) => mercatorTile2lat(y + pointY / tileSize, z))

  const n = mercatorTile2lat(y, z)
  const s = mercatorTile2lat(y + 1, z)
  const latGap = (n - s) / tileSize

  /**
   * 将 mercator 投影转化为 equirectangular 投影
   * 两者的唯一区别在于 lat
   */
  const equirectangularLinePixelList = Array(tileSize)
    .fill(0)
    .map((_, pointY) => {
      const lat = n - pointY * latGap

      const i = mercatorLatArr.findIndex((v) => v < lat)
      if (i === -1) {
        return pixelLineList[pixelLineList.length - 1]
      }
      if (i === 0) {
        return pixelLineList[0]
      }
      return pixelLineList[i - 1]
    })

  self.postMessage(
    new Uint8ClampedArray(equirectangularLinePixelList.flat().flat().flat())
  )
}

const blob = new Blob([
  `self.addEventListener('message', ${mercatorTile2equirectangularTile.toString()}, false);`
])

const mercatorTile2equirectangularTileWorkerUrl = URL.createObjectURL(blob)

export default mercatorTile2equirectangularTileWorkerUrl
