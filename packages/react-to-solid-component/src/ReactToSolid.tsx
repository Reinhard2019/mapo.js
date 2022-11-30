import { ReactElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { createEffect, onCleanup, Component } from 'solid-js'

interface ReactToSolidProps {
  children: ReactElement
  container?: Element
}

const ReactToSolid: Component<ReactToSolidProps> = (props) => {
  let root: Root
  const rootEle = props.container ?? (<div role={'ReactToSolid' as any} /> as Element)
  createEffect(() => {
    root = createRoot(rootEle)
    root.render(props.children)
  })
  onCleanup(() => {
    root.unmount()
  })
  return rootEle
}

export function reactToSolid (children: ReactElement, container?: Element) {
  return <ReactToSolid children={children} container={container} />
}

export default ReactToSolid
