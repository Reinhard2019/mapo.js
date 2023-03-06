import ts from 'rollup-plugin-typescript2'
import commonjs from '@rollup/plugin-commonjs'

export default {
  input: 'src/index.ts',
  output: {
    file: 'esm/index.js',
  },
  plugins: [
    ts({
      tsconfig: 'tsconfig.json',
    }),
    commonjs(),
  ],
}
