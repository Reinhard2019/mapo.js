import React, { ReactElement, useState } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { onMount, onCleanup, Component, createEffect, on } from 'solid-js'

interface ReactToSolidProps {
  children: ReactElement
  container?: Element
}

const ReactToSolid: Component<ReactToSolidProps> = (props) => {
  let root: Root
  const rootEle = props.container ?? (<div role={'ReactToSolid' as any} /> as Element)
  let update: () => void
  const App: React.FunctionComponent = () => {
    const [_, setState] = useState({})
    update = () => setState({})
    return props.children
  }
  onMount(() => {
    root = createRoot(rootEle)
    root.render(React.createElement(App))
  })
  createEffect(
    on(
      () => props.children,
      () => {
        update?.()
      },
      { defer: true }
    )
  )
  onCleanup(() => {
    root.unmount()
  })
  return rootEle
}

export function reactToSolid (children: ReactElement, container?: Element) {
  return <ReactToSolid children={children} container={container} />
}

export default ReactToSolid
