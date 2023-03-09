import Map from './Map'

abstract class Control {
  abstract onAdd(map: Map): void
  abstract onRemove(map: Map): void
}

export default Control
