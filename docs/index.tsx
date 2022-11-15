import 'uno.css';
import '@unocss/reset/tailwind.css'
import { render } from 'solid-js/web';

import App from './App.mdx';

render(() => <App />, document.getElementById('root') as HTMLElement);
