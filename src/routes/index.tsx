import Mapo from 'mapo.js'
import { onCleanup, onMount } from 'solid-js'
import type { Component } from 'solid-js'

const App: Component = () => {
  let ref: HTMLDivElement | undefined
  let mapo: Mapo | undefined

  onMount(() => {
    if (ref instanceof HTMLDivElement) {
      mapo = new Mapo({
        container: ref
      })
    }
  })

  onCleanup(() => {
    console.log('onCleanup')
    mapo?.destroy()
  })

  return <div ref={ref} class="w-screen h-screen" />
}

export default App
