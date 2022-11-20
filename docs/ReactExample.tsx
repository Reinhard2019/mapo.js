import { Button, message, Table } from 'antd'
import { reactToSolid, solidToReact } from 'react-to-solid-component'
import { Component, createSignal } from 'solid-js'

const ReactExample: Component = () => {
  const [index, setIndex] = createSignal(0)

  const dataSource = [
    {
      key: '1',
      name: '胡彦斌',
      age: 32,
      address: '西湖区湖底公园1号'
    },
    {
      key: '2',
      name: '胡彦祖',
      age: 42,
      address: '西湖区湖底公园1号'
    }
  ]

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render (text: string) {
        return solidToReact(<div onClick={() => {
          void message.info(`点击了${text}`)
        }}>{text}</div>)
      }
    },
    {
      title: '年龄',
      dataIndex: 'age',
      key: 'age'
    },
    {
      title: '住址',
      dataIndex: 'address',
      key: 'address'
    }
  ]

  return (
    <>
      {reactToSolid(Button, {
        children: solidToReact(index()),
        onClick () {
          setIndex(v => v + 1)
        }
      })}
      {reactToSolid(Table, {
        dataSource,
        columns
      })}
    </>
  )
}

export default ReactExample
