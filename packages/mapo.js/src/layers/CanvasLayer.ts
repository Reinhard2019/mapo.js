import { Features } from 'src/types'
import Layer from './Layer'
import CanvasLayerManager from './CanvasLayerManager'

abstract class CanvasLayer<Source extends Features = Features, Style extends {} = {}> extends Layer<
  Source,
  Style
> {
  layerManager?: CanvasLayerManager
  imageBitmap?: ImageBitmap
}

export default CanvasLayer
