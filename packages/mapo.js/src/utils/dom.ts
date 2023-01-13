export function canvas2image (canvas: HTMLCanvasElement) {
  const img = new Image()
  img.src = canvas.toDataURL('image/png')
  return img
}
