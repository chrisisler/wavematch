const assert = require('assert')
const wavematch = require('../build/index.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch date specification', () => {
  it('should match the Date constructor', () => {
    const matchedDate = wavematch(new Date())(
      (arg = Date) => accept,
      _ => reject
    )
    eq(matchedDate, accept)
  })
})
