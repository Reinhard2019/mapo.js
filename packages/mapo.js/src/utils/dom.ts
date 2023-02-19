import { ternaryOperation } from '.'

export function canvas2image (canvas: HTMLCanvasElement) {
  const img = new Image()
  img.src = canvas.toDataURL('image/png')
  return img
}

export function unwrapHTMLElement (ele: string | HTMLElement) {
  if (ele instanceof HTMLElement) {
    return ele
  }
  return ternaryOperation(document.body.querySelector(ele), e => e instanceof HTMLElement)
}
