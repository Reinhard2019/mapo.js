import React, { ClassicComponent, ClassicComponentClass, ClassType, ComponentClass, ComponentState, FunctionComponent } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { createEffect, on, onCleanup } from 'solid-js'

interface ReactToSolidProps<P> {
  type: FunctionComponent<P> | ClassType<P, ClassicComponent<P, ComponentState>, ClassicComponentClass<P>> | ComponentClass<P>
  props?: P
}

function ReactToSolid<T extends {}> (props: ReactToSolidProps<T>) {
  let root: Root
  let rootEle: HTMLDivElement | undefined
  createEffect(on([() => props.type, () => props.props], () => {
    root = createRoot(rootEle!)
    root.render(React.createElement<T>(
      props.type,
      props.props
    ))
  }))
  onCleanup(() => {
    root.unmount()
  })
  return <div ref={rootEle} role={'ReactToSolid' as any} />
}

export default ReactToSolid
