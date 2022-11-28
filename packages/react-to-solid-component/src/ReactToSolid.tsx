import React, { ClassicComponent, ClassicComponentClass, ClassType, ComponentClass, ComponentState, FunctionComponent } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { createEffect, onCleanup } from 'solid-js'

type Component<P> = FunctionComponent<P> | ClassType<P, ClassicComponent<P, ComponentState>, ClassicComponentClass<P>> | ComponentClass<P>

interface ReactToSolidProps<P> {
  type: Component<P>
  props?: P
}

function ReactToSolid<P extends {}> (props: ReactToSolidProps<P>) {
  let root: Root
  let rootEle: HTMLDivElement | undefined
  createEffect(() => {
    root = createRoot(rootEle!)
    root.render(React.createElement<P>(
      props.type,
      props.props
    ))
  })
  onCleanup(() => {
    root.unmount()
  })
  return <div ref={rootEle} role={'ReactToSolid' as any} />
}

export function reactToSolid<P extends {}> (type: Component<P>, props?: P) {
  return <ReactToSolid type={type} props={props} />
}

export default ReactToSolid
