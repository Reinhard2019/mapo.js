import { Button } from 'antd'
import { ReactComponent } from 'react-to-solid-component'
import { Component } from 'solid-js'

const ReactExample: Component = () => {
  return (
    <ReactComponent type={Button} props={{}}>
      <span>123</span>
      <span>456</span>
    </ReactComponent>
  )
}

export default ReactExample
