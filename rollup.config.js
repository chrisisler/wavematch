import nodeResolve from 'rollup-plugin-node-resolve'
import babel from 'rollup-plugin-babel'
import replace from 'rollup-plugin-replace'
import uglify from 'rollup-plugin-uglify'

const env = process.env.NODE_ENV

let config = {
  // must be `build` directory because 
  // thats where js files go after removing flow types
  // see `package.json`
  input: 'build/index.js',
  plugins: []
}

if (env === 'cjs') {
  config.output = {
    format: env,
    indent: false
  }

  config.plugins.push(
    babel()
  )
}

if (env === 'development' || env === 'production') {
  config.output = {
    format: 'umd',
    name: 'Wavematch',
    indent: false
  }

  config.plugins.push(
    nodeResolve({
      jsnext: true
    }),
    babel({
      exclude: 'node_modules/**'
    }),
    replace({
      'process.env.NODE_ENV': JSON.stringify(env)
    })
  )
}

if (env === 'production') {
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

export default config
