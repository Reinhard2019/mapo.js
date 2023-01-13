import { chunk, round } from 'lodash-es'

export function scaleImageData (imageData: ImageData, width: number, height: number) {
  const pixelList = chunk(imageData.data, 4)
  const pixelLineList = chunk(pixelList, imageData.width)
  const data = Array(height).fill(0).map((_, y) => {
    const newY = round(y / height * imageData.height)
    const line = pixelLineList[newY]
    if (width === line.length) {
      return line
    }
    const newLine = Array(width).fill(0).map((__, x) => {
      const newX = round(x / width * imageData.width)
      return line[newX]
    })
    pixelLineList.splice(y, 1, newLine)
    return newLine
  })
  return new ImageData(new Uint8ClampedArray(data.flat().flat()), width, height)
}
