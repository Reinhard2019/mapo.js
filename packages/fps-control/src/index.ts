import type { Control, Map } from 'mapo.js'
import Stats from 'stats.js'

class FPSControl implements Control {
  private readonly stats = new Stats()
  onRender = () => {
    this.stats.update()
  }

  onAdd(map: Map) {
    this.stats.dom.style.position = 'absolute'
    map.container.appendChild(this.stats.dom)
    map.addEventListener('render', this.onRender)
  }

  onRemove(map: Map) {
    map.container.removeChild(this.stats.dom)
    map.removeEventListener('render', this.onRender)
  }
}

export default FPSControl
