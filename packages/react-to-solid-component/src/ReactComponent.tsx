import React, { ClassicComponent, ClassicComponentClass, ClassType, ComponentClass, ComponentState, FunctionComponent } from 'react'
import { createRoot } from 'react-dom/client'
import { JSXElement, onMount } from 'solid-js'
import ReactChildren from './ReactChildren'

// type Replace<Obj, NewType, ReplaceType> = {
//   [P in keyof Obj]: Obj[P] extends ReplaceType ? NewType : Obj[P];
// }

interface ReactComponentProps<P> {
  type: FunctionComponent<P> | ClassType<P, ClassicComponent<P, ComponentState>, ClassicComponentClass<P>> | ComponentClass<P>
  props: P
  children: JSXElement
}

function ReactComponent<T extends {}> ({ type, props, children }: ReactComponentProps<T>) {
  let root: HTMLDivElement | undefined
  let childrenEle: HTMLDivElement | undefined
  onMount(() => {
    const reactEle = React.createElement<T>(
      type,
      props,
      React.createElement(ReactChildren, {
        children: childrenEle!,
        root: root!
      })
    )
    createRoot(root!).render(reactEle)
  })
  return (
    <>
      <div ref={root} />
      <div ref={childrenEle}>{children}</div>
    </>
  )
}

export default ReactComponent
