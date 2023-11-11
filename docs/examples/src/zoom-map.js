import { Map } from 'mapo.js'
import anime from 'animejs'

const map = new Map({
  container: '#map',
})

const targets = {
  zoom: 2,
}
anime({
  targets,
  zoom: 5,
  delay: 1000,
  duration: 3000,
  easing: 'linear',
  update: () => {
    map.setZoom(targets.zoom)
  },
})
