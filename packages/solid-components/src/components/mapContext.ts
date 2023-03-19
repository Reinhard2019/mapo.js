import { createContext } from 'solid-js'
import type { Accessor } from 'solid-js'
import type { Map } from 'mapo.js'

export const MapContext = createContext<{
  map?: Accessor<Map | undefined>
}>({})
