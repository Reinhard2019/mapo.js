import { defineConfig } from 'vite'
import solid from 'solid-start/vite'
import UnocssPlugin from '@unocss/vite'
import mdx from '@mdx-js/rollup'
import vercel from 'solid-start-vercel'

export default defineConfig({
  plugins: [
    mdx({ jsxImportSource: 'solid-jsx' }),
    solid({ adapter: vercel() }),
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
