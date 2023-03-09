/**
 * @jest-environment jsdom
 */
import { expect, test } from 'vitest'
import createContext from 'gl'
import Map from './Map'
import { createCanvas } from 'canvas'
import Control from './Control'

class MockControl implements Control {
  onAdd() {}
  onRemove() {}
}

test('map.controlArr', () => {
  const container = document.createElement('div')
  const map = new Map({
    container,
    ssr: true,
    webGLRendererParameters: {
      context: createContext(1, 1),
      canvas: Object.assign(createCanvas(100, 100), {
        style: {},
        addEventListener() {},
      }),
    },
  })

  // @ts-expect-error
  expect(map.controlArr).toStrictEqual([])

  const control = new MockControl()
  map.addControl(control)

  const control2 = new MockControl()
  map.addControl(control2)

  // @ts-expect-error
  expect(map.controlArr).toStrictEqual([control, control2])

  // 重复添加
  map.addControl(control2)
  // @ts-expect-error
  expect(map.controlArr).toStrictEqual([control, control2])

  map.removeControl(control)
  // @ts-expect-error
  expect(map.controlArr).toStrictEqual([control2])
})
