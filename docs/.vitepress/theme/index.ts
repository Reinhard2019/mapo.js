import 'uno.css'
import DefaultTheme from 'vitepress/theme'
import './styles/index.css'
import Example from './components/Example.vue'

export default {
  ...DefaultTheme,
  enhanceApp(ctx) {
    DefaultTheme.enhanceApp(ctx)
    ctx.app.component('Example', Example)
  },
}
