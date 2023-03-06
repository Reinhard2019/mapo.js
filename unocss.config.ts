/* eslint-disable @typescript-eslint/promise-function-async */
import { defineConfig } from '@unocss/vite'
import { presetMini } from '@unocss/preset-mini'
import presetIcons from '@unocss/preset-icons'
import transformerVariantGroup from '@unocss/transformer-variant-group'

export default defineConfig({
  transformers: [transformerVariantGroup()],
  presets: [
    presetMini(),
    presetIcons({
      collections: {
        'ant-design': () => import('@iconify-json/ant-design').then(i => i.icons),
      },
    }),
  ],
  variants: [
    /**
     * child:
     */
    matcher => {
      const prevReg = /^child\[(.*)\]:/
      const match = matcher.match(prevReg)
      if (!match) return matcher
      return {
        matcher: matcher.slice(match[0].length),
        selector: s => `${s} ${match[1] || '*'}`,
      }
    },
  ],
})
