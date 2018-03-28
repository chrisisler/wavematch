const assert = require('assert')
const wavematch = require('../lib/index.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch function specification', () => {
  // prettier-ignore
  const matchFn = fn => wavematch(fn)(
    (arg = Function) => accept,
    _ => reject
  )

  it('should match the Function constructor', () => {
    eq(matchFn(() => {}), accept)
    eq(matchFn(function() {}), accept)
    eq(matchFn(new Function()), accept)
  })

  it('should match generator functions', () => {
    eq(matchFn(function*() {}), accept)
  })
})
