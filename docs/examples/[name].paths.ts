import fs from 'fs'
import path from 'path'

export default {
  watch: './src/**',
  paths() {
    const srcDir = path.resolve(__dirname, './src')
    return fs.readdirSync(srcDir).map(name => {
      return {
        params: {
          name: name.replace(/.js/, ''),
        },
      }
    })
  },
}
