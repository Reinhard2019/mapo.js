import React, { FunctionComponent, ReactElement, useEffect, useRef } from 'react'
import { JSX } from 'solid-js'
import { render } from 'solid-js/web'

interface SolidToReactProps {
  children: JSX.Element
  container?: ReactElement
}

const SolidToReact: FunctionComponent<SolidToReactProps> = ({ children, container }) => {
  const ref = useRef<HTMLDivElement>()

  useEffect(() => render(() => children, ref.current!), [])

  return container
    ? React.cloneElement(container, {
      ref,
    })
    : React.createElement('div', { ref, role: 'SolidToReact' })
}

export const solidToReact = (children: JSX.Element, container?: ReactElement) => React.createElement(SolidToReact, {
  children,
  container
})

export default SolidToReact
