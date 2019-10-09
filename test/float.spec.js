const assert = require('assert')
const wavematch = require('../dist/wavematch.cjs.development.js')
const { accept, reject, eq } = require('./shared.js')

// Note: If float ends in .0 (like 2.0) it's automatically converted to
// whole numbers when the parameter is passed to the wavematch function.
// This means we never know if someone entered Num.0 or just Num.
describe('wavematch float specification', () => {
  it('should ignore whole number patterns', () => {
    let match = wavematch(1.1)(
      (float = 1) => reject,
      _ => accept
    )
    eq(match, accept)

    let match2 = wavematch(1)(
      (float = 1.1) => reject,
      _ => accept
    )
    eq(match, accept)
  })

  it('should have higher precendece below whole number patterns', () => {
    let match = wavematch(1)(
      (float = 1.0) => accept,
      (float = Number) => reject,
      _ => reject
    )
    eq(match, accept)

    let match2 = wavematch(1.1)(
      (float = 1) => reject,
      (float = Number) => accept,
      _ => reject
    )
    eq(match2, accept)

    let match3 = wavematch(1.1)(
      (float = 1) => reject,
      // should reject because of next rule
      (float = Number) => reject,
      (float = 1.1) => accept,
      _ => reject
    )
    eq(match3, accept)
  })
})
