import { ternaryOperation } from '.'

export function canvas2image(canvas: HTMLCanvasElement) {
  const img = new Image()
  img.src = canvas.toDataURL('image/png')
  return img
}

export function unwrapHTMLElement(ele: string | HTMLElement) {
  if (typeof ele === 'string') {
    return ternaryOperation(document.body.querySelector(ele), e => e instanceof HTMLElement)
  }
  return ele
}
