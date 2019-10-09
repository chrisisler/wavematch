const assert = require('assert')
const wavematch = require('../dist/wavematch.cjs.development.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch date specification', () => {
  it('should match the Date constructor', () => {
    const matchedDate = wavematch(new Date())(
      (arg = Date) => accept,
      _ => reject,
    )
    eq(matchedDate, accept)
  })
})
