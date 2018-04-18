const assert = require('assert')
const wavematch = require('../lib/index.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch guard specification', () => {
  it('should work', () => {
    // prettier-ignore
    eq(wavematch(42)(
      (num = 3) => reject,
      (num = 99) => reject,
      (num = $ => 99 > $) => accept,
      _ => reject
    ), accept)
  })

  it('should be compatible with constructor matching', () => {
    // prettier-ignore
    eq(wavematch(7)(
      (num = 3) => 0,
      // this rule wins because it Number matches before the guard has a chance
      (num = Number) => accept,
      (num = $ => $ === 7) => reject,
      _ => 2
    ), accept)

    // prettier-ignore
    eq(wavematch(42)(
      (num = 3) => reject,
      // this rule wins only because it is BEFORE the Number pattern
      (num = $ => $ > 41) => accept,
      (num = Number) => 3,
      _ => reject
    ), accept)
  })

  it('should throw Error if guard function does not return Boolean', () => {
    assert.throws(() => {
      // prettier-ignore
      wavematch('foo')(
        (str = str => 'lul') => 'not gonna happen pal'
      )
      // prettier-ignore
      wavematch('foo')(
        (str = str => 42) => 'not gonna happen pal'
      )
      // prettier-ignore
      wavematch('foo')(
        (str = str => ({})) => 'not gonna happen pal'
      )
      // prettier-ignore
      wavematch('foo')(
        (str = str => (()=>{})) => 'not gonna happen pal'
      )
      // prettier-ignore
      wavematch('foo')(
        (str = str => /lmao/) => 'not gonna happen pal'
      )
      // prettier-ignore
      wavematch('foo')(
        (str = str => []) => 'not gonna happen pal'
      )
    }, Error)
  })
})
