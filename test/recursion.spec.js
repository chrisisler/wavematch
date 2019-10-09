const assert = require('assert')
const wavematch = require('../dist/wavematch.cjs.development.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch recursion specification', () => {
  // it('should work for recursive fibonacci', () => {
  //   // TODO
  // })

  it('should work for recursive Math.max definition', () => {
    const max = wavematch.create(
      (xs = []) => { throw Error('Empty list') },
      (xs = $ => $.length === 1) => xs[0],
      ([first, ...rest]) => {
        let maxRest = max(rest)
        return first > maxRest ? first : maxRest
      }
    )

    eq(max([1, 2, 3]), 3)
    eq(max([1, 2, -3]), 2)
    eq(max([1]), 1)

    assert.throws(() => {
      max([])
    })
  })
})
