const assert = require('assert')
const wavematch = require('../lib/index.js')
const { accept, reject, eq } = require('./shared.js')

describe.only('wavematch object specification', () => {
  it('should match destructured defaults', () => {
    const matchedUnary = wavematch({ x: 1, y: 2 })(
      (value = { x: 1, y: 2 }) => accept
      _ => reject
    )
    eq(matchedUnary, accept)
  })
})
