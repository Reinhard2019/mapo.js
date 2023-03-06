import { Map } from 'mapo.js'

const container = document.getElementById('map')

const map = new Map({
  container,
  center: [116.405285, 39.904989],
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

  const positions = map.getDisplayPolygon().geometry.coordinates[0]

  ctx.beginPath()
  positions.forEach((v, i) => {
    const [x, y] = projection(v)
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  ctx.strokeStyle = 'white'
  ctx.stroke()

  ctx.beginPath()
  positions.forEach((v, i) => {
    const [x, y] = map.project(v, { allowNotVisible: true })
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  ctx.strokeStyle = 'red'
  ctx.stroke()
}

map.addEventListener('move', updateDisplayPolygon)
map.addEventListener('rotate', updateDisplayPolygon)
map.addEventListener('zoom', updateDisplayPolygon)
updateDisplayPolygon()
