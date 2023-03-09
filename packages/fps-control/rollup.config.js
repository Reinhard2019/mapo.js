import ts from 'rollup-plugin-typescript2'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'

export default [
  {
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
    external: ['stats.js'],
  },
  {
    input: 'src/index.ts',
    output: {
      name: 'FPSControl',
      file: 'dist/index.js',
      format: 'iife',
      globals: {
        'mapo.js': 'Mapo',
      },
    },
    context: 'window',
    plugins: [
      ts({
        tsconfig: 'tsconfig.json',
        tsconfigOverride: {
          compilerOptions: {
            declaration: false,
          },
        },
      }),
      nodeResolve({
        browser: true,
      }),
      commonjs(),
    ],
  },
]
