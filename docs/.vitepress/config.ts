import { defineConfig } from 'vitepress'
import UnoCSS from 'unocss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

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
      { text: '示例', link: '/examples/hello-world', activeMatch: '/examples/' },
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
            { text: '你好，世界', link: '/examples/hello-world' },
            { text: 'hash', link: '/examples/hash' },
          ],
        },
        {
          text: '图层',
          items: [
            { text: '文字', link: '/examples/text-layer' },
            { text: '线条', link: '/examples/line-layer' },
            { text: '填充', link: '/examples/fill-layer' },
          ],
        },
        {
          text: 'three',
          items: [{ text: '辅助坐标轴', link: '/examples/axes-helper' }],
        },
        {
          text: '控件',
          items: [
            { text: '显示区域', link: '/examples/display-area' },
            { text: 'FPS', link: '/examples/fps' },
          ],
        },
        {
          text: 'api',
          items: [{ text: 'flyTo', link: '/examples/flyTo' }],
        },
      ],
    },
    footer: {
      message: `
        <a href="http://beian.miit.gov.cn/" target="_blank" style="display: flex; justify-content: center; align-items: center; opacity: 0.7;">
          <img src="https://www.beian.gov.cn/img/new/gongan.png" alt="公安备案icon" style="margin-right: 4px;">
          赣ICP备2023002130号
        </a>
      `,
      copyright: 'Released under the MIT License. Copyright © 2023-present 丁磊',
    },
  },
  vite: {
    server: {
      port: 9999,
    },
    plugins: [
      UnoCSS({}),
      visualizer({
        emitFile: true,
        filename: 'stats.html',
      }),
    ],
  },
})
