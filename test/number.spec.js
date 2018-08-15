const assert = require('assert')
const wavematch = require('../lib/wavematch.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch number specification', () => {
  it('should match whole integers', () => {
    const integer = wavematch(42)(
      (num = 42) => accept,
      _ => reject
    )
    eq(integer, accept)
  })

  it('should work with constructor', () => {
    const constructor = wavematch(3)(
      (n = Number) => accept,
      _ => reject
    )
    eq(constructor, accept)

    const withOtherNums = wavematch(3)(
      (n = 2) => reject,
      (n = Number) => reject,
      (n = 3) => accept,
      _ => reject
    )
    eq(withOtherNums, accept)

    const mixed = wavematch(0)(
      (n = 1) => reject,
      (n = Number) => accept,
      _ => reject
    )
  })
})
