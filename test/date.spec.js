const assert = require('assert')
const wavematch = require('../lib/index.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch date specification', () => {
  it('should match the Date constructor', () => {
    // prettier-ignore
    const matchedDate = wavematch(new Date())(
      (arg = Date) => accept,
      _ => reject
    )
    eq(matchedDate, accept)
  })
})
