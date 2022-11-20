import 'uno.css'
import '@unocss/reset/tailwind.css'
import 'antd/dist/reset.css'
import { render } from 'solid-js/web'

import App from './App'
// import ReactExample from './ReactExample'

render(() => <App />, document.getElementById('root') as HTMLElement)
