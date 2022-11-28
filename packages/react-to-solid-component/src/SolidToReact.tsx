import React, { FunctionComponent, useEffect, useRef } from 'react'
import { JSX } from 'solid-js'
import { render } from 'solid-js/web'

interface SolidToReactProps {
  children: JSX.Element
}

const SolidToReact: FunctionComponent<SolidToReactProps> = ({ children }) => {
  const ref = useRef<HTMLDivElement>()

  useEffect(() => render(() => children, ref.current!), [])

  return React.createElement('div', { ref, role: 'SolidToReact' })
}

export const solidToReact = (children: JSX.Element) => React.createElement(SolidToReact, {
  children
})

export default SolidToReact
