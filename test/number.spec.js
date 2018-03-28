const assert = require('assert')
const wavematch = require('../lib/index.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch number specification', () => {
  it('should match default', () => {
    // not even sure if this test is useful
    // prettier-ignore
    ;[ -1, -0, 0, +0, +1 ].forEach(num => {
      const _default = wavematch(num)(
        _ => accept,
      )
      eq(_default, accept)
    })
  })

  it('should match whole integers', () => {
    // prettier-ignore
    const integer = wavematch(42)(
      (num = 42) => accept,
      _ => reject
    )
    eq(integer, accept)
  })
})
