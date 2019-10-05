import replace from 'rollup-plugin-replace'
import babel from 'rollup-plugin-babel'
import typescript from 'rollup-plugin-typescript'

import pkg from './package.json'

export default async function() {
  const env = process.env.NODE_ENV
  const config = {
    plugins: [
      typescript(),
      babel({
        exclude: 'node_modules/**'
      }),
      replace({
        'process.env.NODE_ENV': JSON.stringify(env)
      })
    ],
    input: 'src/wavematch.ts',
    output: [
      {
        file: pkg.main,
        format: 'cjs'
      },
      {
        file: pkg.module,
        format: 'es'
      }
    ],
    // tell rollup we depend on external deps
    external: [...Object.keys(pkg.dependencies)],
    watch: {
      include: 'src/**.ts',
      exclude: 'node_modules/**'
    }
  }

  if (env === 'production') {
    const uglify = await import('rollup-plugin-uglify')
    config.plugins.push(
      uglify({
        compress: {
          pure_getters: true,
          unsafe: true,
          unsafe_comps: true,
          warnings: false
        }
      })
    )
  }

  return config
}
