const assert = require('assert')
const wavematch = require('../lib/index.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch array specification', () => {
  it('should match constructor', () => {
    const number = 42
    //prettier-ignore
    const foo = wavematch(number)(
      (n = Number) => accept,
      _ => reject
    )
    eq(foo, accept)
  })
  it('should match destructured', () => {
    //prettier-ignore
    const foo = wavematch([ 1, 2 ])(
      (nums = [ 1, 2 ]) => accept,
      _ => reject
    )
  })
})
