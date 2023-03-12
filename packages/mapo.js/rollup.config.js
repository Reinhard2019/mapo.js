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
        exclude: ['src/**/*.test.ts'],
      }),
      commonjs(),
    ],
    external: ['lodash-es', 'three', '@turf/turf'],
  },
  process.env.NODE_ENV === 'production' && {
    input: 'src/index.ts',
    output: {
      name: 'Mapo',
      file: 'dist/index.js',
      format: 'iife',
      globals: {
        three: 'THREE',
      },
    },
    context: 'window',
    plugins: [
      ts({
        tsconfig: 'tsconfig.json',
        exclude: ['src/**/*.test.ts'],
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
    external: ['three'],
  },
].filter(v => v)
