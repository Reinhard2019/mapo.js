import 'uno.css'
import '@unocss/reset/tailwind.css'
import 'antd/dist/antd.css'
import { render } from 'solid-js/web'

// import App from './App'
import ReactExample from './ReactExample'

render(() => <ReactExample />, document.getElementById('root') as HTMLElement)
