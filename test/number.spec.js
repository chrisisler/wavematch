const assert = require('assert')
const wavematch = require('../build/index.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch number specification', () => {
  it('should match default', () => {
    // not even sure if this test is useful
    ;[ -1, -0, 0, +0, +1 ].forEach(num => {
      const _default = wavematch(num)(
        _ => accept,
      )
      eq(_default, accept)
    })
  })

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
