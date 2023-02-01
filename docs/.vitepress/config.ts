import { defineConfig } from 'vitepress';
import UnoCSS from 'unocss/vite';

// https://github1s.com/vitejs/vite/blob/HEAD/docs/.vitepress/config.ts#L1
export default defineConfig({
  title: 'Mapo.js',
  description: '3D 地图',
  themeConfig: {
    siteTitle: 'Mapo.js',
    nav: [{ text: 'Guide', link: '/guide' }],
  },
  vite: {
    plugins: [UnoCSS({})],
  },
});
