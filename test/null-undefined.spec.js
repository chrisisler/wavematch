const assert = require('assert')
const wavematch = require('../dist/wavematch.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch null specification', () => {
  it('should match null literal keyword', () => {
    const match = wavematch(null) (
      // give index/order precedence to `undefined` here to ensure
      // triple equals check is used (a === b)
      (input = undefined) => reject,
      (input = null) => accept,
      _ => reject
    )
    eq(match, accept)
  })
})

describe('wavematch undefined specification', () => {
  it('should match undefined literal keyword', () => {
    const match = wavematch(undefined) (
      // give index/order precedence to `null` here to ensure
      // triple equals check is used (a === b)
      // (because null == undefined evaluates to true)
      (input = null) => reject,
      (input = undefined) => accept,
      _ => reject
    )
    eq(match, accept)
  })
})
