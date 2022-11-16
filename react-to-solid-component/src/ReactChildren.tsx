import React, { useEffect, useRef } from 'react'

function ReactChildren ({ children, root }: { children: HTMLDivElement, root: HTMLDivElement }) {
  const ref = useRef<HTMLDivElement>()
  useEffect(() => {
    Array.from(children.childNodes).forEach((node) => {
      ref.current?.parentNode?.insertBefore(node, ref.current)
    })
    ref.current?.remove()

    Array.from(root.childNodes).forEach(node => {
      root.parentNode?.insertBefore(node, root)
    })
    root.remove()
  }, [])
  return React.createElement('div', {
    ref
  })
}

export default ReactChildren
