import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'packages/mapo.js/src/Map.test.ts'],
  },
})
