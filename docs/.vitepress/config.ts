import { defineConfig } from 'vitepress'
import UnoCSS from 'unocss/vite'

// https://github1s.com/vitejs/vite/blob/HEAD/docs/.vitepress/config.ts#L1
export default defineConfig({
  title: 'Mapo.js',
  description: '3D 地图',
  cleanUrls: true,
  head: [['link', { rel: 'shortcut icon', href: '/logo.png' }]],
  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'Mapo.js',
    nav: [
      { text: '使用教程', link: '/guide/quick-start', activeMatch: '/guide/' },
      { text: '示例', link: '/examples/', activeMatch: '/examples/' },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/Reinhard2019/mapo.js' }],
    sidebar: {
      '/guide/': [
        {
          text: '开始',
          items: [{ text: '快速上手', link: '/guide/quick-start' }],
        },
      ],
      '/examples/': [
        {
          text: '基础',
          items: [
            { text: '你好，世界', link: '/examples/#hello-world' },
            { text: 'hash', link: '/examples/#hash' },
          ],
        },
        {
          text: '图层',
          items: [
            { text: '文字', link: '/examples/#text-layer' },
            { text: '线条', link: '/examples/#line-layer' },
            { text: '填充', link: '/examples/#fill-layer' },
          ],
        },
        {
          text: 'three',
          items: [{ text: '辅助坐标轴', link: '/examples/#axes-helper' }],
        },
        {
          text: 'debug',
          items: [{ text: '显示区域', link: '/examples/#display-area' }],
        },
      ],
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2023-present 丁磊',
    },
  },
  vite: {
    server: {
      port: 9999,
    },
    plugins: [UnoCSS({})],
  },
})
