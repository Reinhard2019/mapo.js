import { Map } from 'mapo.js'
import * as THREE from 'three'

const map = new Map({
  container: '#map',
  center: [116.405285, 39.904989],
})

const axesHelper = new THREE.AxesHelper(map.earthRadius * 2)
map.scene.add(axesHelper)
