import replace from 'rollup-plugin-replace'
import babel from 'rollup-plugin-babel'
import pkg from './package.json'

export default async function getConfig() {
  let env = process.env.NODE_ENV
  let config = {
    plugins: [
      babel({
        exclude: 'node_modules/**'
      }),
      replace({
        'process.env.NODE_ENV': JSON.stringify(env)
      })
    ],
    input: 'src/wavematch.js',
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
    external: [
      ...Object.keys(pkg.dependencies)
    ],
    watch: {
      include: 'src/**.js',
      exclude: 'node_modules/**'
    }
  }

  // if (env === 'development' || env === 'production') {
  //   config.plugins.push(
  //     babel({
  //       exclude: 'node_modules/**'
  //     })
  //   )
  // }


  if (env === 'production') {
    let uglify = await import('rollup-plugin-uglify')
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
