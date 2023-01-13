import { defineConfig } from 'vite'
import solid from 'solid-start/vite'
import UnocssPlugin from '@unocss/vite'
import mdx from '@mdx-js/rollup'

export default defineConfig({
  plugins: [
    mdx({ jsxImportSource: 'solid-jsx' }),
    solid({
    }),
    UnocssPlugin({
      // your config or in uno.config.ts
    })
  ],
  server: {
    port: 3000
  },
  build: {
    target: 'esnext'
  }
})
