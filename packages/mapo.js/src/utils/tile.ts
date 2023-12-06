import { BBox, TileBox, TileBoxWithZ, XYZ } from '../types'
import { lineContain, lineOverlap, pointInBBox } from './bbox'
import { isEqual } from 'lodash-es'
import { formatXYZ } from './map'

export function xyzToTileBox(xyz: XYZ): TileBoxWithZ {
  const [x, y, z] = xyz
  return {
    startX: x,
    startY: y,
    endX: x + 1,
    endY: y + 1,
    z,
  }
}

export function updateTileBoxZ(_tileBox: TileBoxWithZ, z: number) {
  const tileBox = { ..._tileBox }

  if (tileBox.z === z) return tileBox

  const zSquare = Math.pow(2, z - tileBox.z)
  tileBox.startX = Math.floor(tileBox.startX * zSquare)
  tileBox.endX = Math.ceil(tileBox.endX * zSquare)
  tileBox.startY = Math.floor(tileBox.startY * zSquare)
  tileBox.endY = Math.ceil(tileBox.endY * zSquare)
  tileBox.z = z
  return tileBox
}

/**
 * 统一两个 TileBox 之间的 z
 * @param _tileBox1
 * @param _tileBox2
 * @returns
 */
export function synchroTileBoxZ(_tileBox1: TileBoxWithZ, _tileBox2: TileBoxWithZ) {
  const z1 = _tileBox1.z
  const z2 = _tileBox2.z
  const tileBox1 = { ..._tileBox1 }
  const tileBox2 = { ..._tileBox2 }
  if (z1 > z2) {
    const zSquare = Math.pow(2, z1 - z2)
    tileBox2.startX *= zSquare
    tileBox2.endX *= zSquare
    tileBox2.startY *= zSquare
    tileBox2.endY *= zSquare
    tileBox2.z = z1
  } else if (z1 < z2) {
    const zSquare = Math.pow(2, z2 - z1)
    tileBox1.startX *= zSquare
    tileBox1.endX *= zSquare
    tileBox1.startY *= zSquare
    tileBox1.endY *= zSquare
    tileBox1.z = z2
  }
  return [tileBox1, tileBox2]
}

export function tileBox2bbox(tileBox: TileBox) {
  return [tileBox.startX, tileBox.startY, tileBox.endX, tileBox.endY] as BBox
}

/**
 * 处理 TileBox 超出[0, z*z]的情况
 * @param _a
 * @param _b
 * @param z
 * @returns
 */
function synchroTileLine(
  _a: [number, number],
  _b: [number, number],
  z: number,
): [[number, number], [number, number]] {
  const zSquare = Math.pow(2, z)
  const a: typeof _a = [..._a]
  const b: typeof _b = [..._b]

  if (a[0] < 0 && b[0] >= a[1]) {
    b[0] -= zSquare
    b[1] -= zSquare
  } else if (a[1] > zSquare && b[1] <= a[0]) {
    b[0] += zSquare
    b[1] += zSquare
  } else if (b[0] < 0 && a[0] >= b[1]) {
    a[0] -= zSquare
    a[1] -= zSquare
  } else if (b[1] > zSquare && a[1] <= b[0]) {
    a[0] += zSquare
    a[1] += zSquare
  }
  return [a, b]
}

/**
 * 前者的边界是否完全包括了后者
 * @param parent
 * @param child
 * @returns
 */
export function tileBoxContain(_parent: TileBoxWithZ, _child: TileBoxWithZ) {
  const [parent, child] = synchroTileBoxZ(_parent, _child)
  return (
    lineContain(
      ...synchroTileLine([parent.startX, parent.endX], [child.startX, child.endX], parent.z),
    ) &&
    lineContain(
      ...synchroTileLine([parent.startY, parent.endY], [child.startY, child.endY], parent.z),
    )
  )
}

/**
 * 计算两个瓦片边界是否重叠
 * @param _tileBox1 瓦片边界框1
 * @param _tileBox2 瓦片边界框2
 * @returns 返回是否重叠
 */
export function tileBoxOverlap(_tileBox1: TileBoxWithZ, _tileBox2: TileBoxWithZ) {
  const [tileBox1, tileBox2] = synchroTileBoxZ(_tileBox1, _tileBox2)
  return (
    lineOverlap(
      ...synchroTileLine(
        [tileBox1.startX, tileBox1.endX],
        [tileBox2.startX, tileBox2.endX],
        tileBox1.z,
      ),
    ) &&
    lineOverlap(
      ...synchroTileLine(
        [tileBox1.startY, tileBox1.endY],
        [tileBox2.startY, tileBox2.endY],
        tileBox1.z,
      ),
    )
  )
}

/**
 * 获取两个瓦片边界重叠的部分，如果不重叠返回 null
 * @param _tileBox1
 * @param _tileBox2
 * @returns
 */
export function getOverlapTileBox(
  _tileBox1: TileBoxWithZ,
  _tileBox2: TileBoxWithZ,
): TileBoxWithZ | null {
  if (_tileBox1.z === 0) return _tileBox2
  if (_tileBox2.z === 0) return _tileBox1

  if (!tileBoxOverlap(_tileBox1, _tileBox2)) return null

  const [tileBox1, tileBox2] = synchroTileBoxZ(_tileBox1, _tileBox2)
  const [[startX1, endX1], [startX2, endX2]] = synchroTileLine(
    [tileBox1.startX, tileBox1.endX],
    [tileBox2.startX, tileBox2.endX],
    tileBox1.z,
  )
  const [[startY1, endY1], [startY2, endY2]] = synchroTileLine(
    [tileBox1.startY, tileBox1.endY],
    [tileBox2.startY, tileBox2.endY],
    tileBox1.z,
  )
  return normalizeTileBox({
    startX: Math.max(startX1, startX2),
    endX: Math.min(endX1, endX2),
    startY: Math.max(startY1, startY2),
    endY: Math.min(endY1, endY2),
    z: tileBox1.z,
  })
}

/**
 * 归一化 tileBox，处理边界超出 0～z*z 的情况
 * @param tileBox
 * @returns
 */
export function normalizeTileBox(tileBox: TileBoxWithZ): TileBoxWithZ {
  const res = { ...tileBox }
  const zSquare = Math.pow(2, tileBox.z)
  if (res.startX >= zSquare) {
    res.startX -= zSquare
    res.endX -= zSquare
  } else if (res.endX <= 0) {
    res.startX += zSquare
    res.endX += zSquare
  }
  if (res.startY >= zSquare) {
    res.startY -= zSquare
    res.endY -= zSquare
  } else if (res.endY <= 0) {
    res.startY += zSquare
    res.endY += zSquare
  }
  return res
}

export function isEqualTileBox(_tileBox1: TileBoxWithZ | null, _tileBox2: TileBoxWithZ | null) {
  if (!_tileBox1 || !_tileBox2) {
    return _tileBox1 === _tileBox2
  }

  const [tileBox1, tileBox2] = synchroTileBoxZ(_tileBox1, _tileBox2)
  return isEqual(tileBox1, tileBox2)
}

/**
 * 判断两个 xyz 是否互相从属，不从属，返回 0，后者从属于前者，返回 1，前者从属于后者，返回 -1
 * @param xyz1
 * @param xyz2
 * @returns
 */
export function isBelongXYZ(xyz1: XYZ, xyz2: XYZ) {
  if (xyz1[2] === xyz2[2]) return 0

  if (xyz1[2] > xyz2[2]) {
    const z2 = Math.pow(2, xyz1[2] - xyz2[2])
    const bbox: BBox = [xyz2[0] * z2, xyz2[1] * z2, xyz2[0] * z2 + z2, xyz2[1] * z2 + z2]
    return pointInBBox([xyz1[0], xyz1[1]], bbox) ? -1 : 0
  }

  const z2 = Math.pow(2, xyz2[2] - xyz1[2])
  const bbox: BBox = [xyz1[0] * z2, xyz1[1] * z2, xyz1[0] * z2 + z2, xyz1[1] * z2 + z2]
  return pointInBBox([xyz2[0], xyz2[1]], bbox) ? 1 : 0
}

/**
 * 获取上n个层级的 xyz
 * @param xyz
 * @param n
 * @returns
 */
export function getPrevZoomXYZ(xyz: XYZ, n = 1) {
  if (xyz[2] <= 0) return
  if (n < 1) return xyz
  const zSquare = Math.pow(2, n)
  return [Math.floor(xyz[0] / zSquare), Math.floor(xyz[1] / zSquare), xyz[2] - n] as XYZ
}

/**
 * 获取下n个层级的 xyz 列表
 * @param xyz
 * @param n
 * @returns
 */
export function getNextZoomXYZList(xyz: XYZ, n = 1): XYZ[] {
  const [x, y, z] = xyz
  const nextZ = z + n
  const xyzList: XYZ[] = []
  for (let nextX = x * 2; nextX < x * 2 + 2; nextX++) {
    for (let nextY = y * 2; nextY < y * 2 + 2; nextY++) {
      xyzList.push([nextX, nextY, nextZ])
    }
  }
  return xyzList
}

export function tileBox2xyzList(tileBox: TileBoxWithZ) {
  const xyzList: XYZ[] = []
  for (let tileX = tileBox.startX; tileX < tileBox.endX; tileX++) {
    for (let tileY = tileBox.startY; tileY < tileBox.endY; tileY++) {
      const xyz: XYZ = formatXYZ([tileX, tileY, tileBox.z])
      xyzList.push(xyz)
    }
  }
  return xyzList
}
