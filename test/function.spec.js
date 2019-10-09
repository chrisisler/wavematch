const assert = require('assert')
const wavematch = require('../dist/wavematch.cjs.development.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch function specification', () => {
  const matchFn = fn => wavematch(fn)((arg = Function) => accept, _ => reject)

  it('should match the Function constructor', () => {
    eq(matchFn(() => {}), accept)
    eq(matchFn(function() {}), accept)
    eq(matchFn(function f() {}), accept)
    eq(matchFn(new Function()), accept)
    eq(matchFn(Function()), accept)
    eq(matchFn(Function.apply(null, [])), accept)
    eq(matchFn({ method: function() {} }.method), accept)
    eq(matchFn({ method() {} }.method), accept)
    eq(matchFn((() => () => {})()), accept)
  })

  it('should match generator functions', () => {
    eq(matchFn(function*() {}), accept)
    eq(matchFn(function* g() {}), accept)
  })
})
