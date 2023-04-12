// 监听代码修改，自动重新打包的脚本
// 为什么不使用 rollup -w ?
// 由于 rollup -w 在修改 Map.ts 等文件时一直等待，可能是 rollup 的 bug
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import chokidar from 'chokidar'
import { spawn } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const build = () => {
  const bat = spawn('npx', ['rollup', '-c'])

  bat.stdout.on('data', data => {
    console.log(data.toString())
  })

  bat.stderr.on('data', data => {
    console.error(data.toString())
  })

  bat.on('exit', code => {
    console.log(`Child exited with code ${code}`)
  })
}

chokidar.watch(__dirname + '/src').on('change', build)

build()
