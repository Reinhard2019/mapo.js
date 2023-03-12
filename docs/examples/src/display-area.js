import { Map } from 'mapo.js'

const container = document.getElementById('map')

const map = new Map({
  container,
  center: [116.405285, 39.904989],
  hash: true,
})

const canvas = document.createElement('canvas')
canvas.width = container.clientWidth
canvas.height = container.clientHeight
canvas.style.position = 'absolute'
canvas.style.inset = 0
container.appendChild(canvas)
const ctx = canvas.getContext('2d')

function projection(position) {
  const [w, s, e, n] = [-180, -90, 180, 90]
  const [width, height] = [canvas.clientWidth, canvas.clientHeight]

  const [lng, lat] = position
  const x = ((lng - w) / (e - w)) * width
  const y = ((n - lat) / (n - s)) * height
  return [x, y]
}

function updateDisplayPolygon() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const positions = map.displayPolygon.coordinates[0]

  ctx.beginPath()
  ctx.fillStyle = 'red'
  ctx.font = `${20}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  positions.forEach((position, i) => {
    const [x, y] = projection(position)
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
    ctx.fillText(i + ':' + position.map(v => Math.round(v)), x, y)
  })
  ctx.strokeStyle = 'white'
  ctx.stroke()

  ctx.beginPath()
  ctx.fillStyle = 'white'
  positions.forEach((position, i) => {
    const [x, y] = map.project(position, { allowNotVisible: true })
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
    ctx.fillText(i + ':' + position.map(v => Math.round(v)), x, y)
  })
  ctx.strokeStyle = 'red'
  ctx.stroke()
}

map.addEventListener('move', updateDisplayPolygon)
map.addEventListener('rotate', updateDisplayPolygon)
map.addEventListener('zoom', updateDisplayPolygon)
updateDisplayPolygon()
