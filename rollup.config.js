const nodeResolve = require('rollup-plugin-node-resolve')
const replace = require('rollup-plugin-replace')
const uglify = require('rollup-plugin-uglify')

const env = process.env.NODE_ENV

let config = {
  // must be `build` directory because 
  // thats where js files go after removing flow types
  // see `package.json`
  input: 'build/index.js',
  plugins: []
}

if (env === 'es' || env === 'cjs') {
  config.output = {
    format: env,
    indent: false
  }
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

module.exports = config
