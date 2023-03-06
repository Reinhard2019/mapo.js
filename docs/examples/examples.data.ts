import fs from 'fs'
import path from 'path'

export declare const data: Record<string, string>

export default {
  watch: './src/**',
  load() {
    const srcDir = path.resolve(__dirname, './src')
    return readExamples(srcDir)
  },
}

function readExamples(srcDir: string): Record<string, string> {
  const examples = fs.readdirSync(srcDir)
  const _data: Record<string, string> = {}
  for (const name of examples) {
    const fullPath = `${srcDir}/${name}`
    _data[name.replace(/.js/, '')] = fs.readFileSync(fullPath, 'utf-8')
  }
  return _data
}
