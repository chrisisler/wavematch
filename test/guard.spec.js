const assert = require('assert')
const wavematch = require('../dist/wavematch.cjs.development.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch guard specification', () => {
  it('should work', () => {
    eq(
      wavematch(42)(
        (num = 3) => reject,
        (num = 99) => reject,
        (num = $ => 99 > $) => accept,
        _ => reject,
      ),
      accept,
    )

    let m = wavematch({ status: 401 })(
      (x = $ => $.status > 400) => accept,
      _ => reject,
    )
    eq(m, accept)
  })

  // See README on `Gotchas` section:
  it('should depend on branch/condition ordering', () => {
    let unordered1 = num =>
      wavematch(num)(
        (n = $ => $ <= 82500) => accept, // wins cause it's first
        (n = $ => $ <= 38700) => reject,
        _ => reject,
      )

    let unordered2 = num =>
      wavematch(num)(
        (n = $ => $ <= 38700) => accept, // wins cause it's first
        (n = $ => $ <= 82500) => reject,
        _ => reject,
      )

    eq(unordered1(2), accept)
    eq(unordered2(2), accept)
  })

  it('should be compatible with constructor matching', () => {
    eq(
      wavematch(7)(
        (num = 3) => 0,
        // this rule wins because it Number matches before the guard has a chance
        (num = Number) => accept,
        (num = $ => $ === 7) => reject,
        _ => 2,
      ),
      accept,
    )

    eq(
      wavematch(42)(
        (num = 3) => reject,

        // this rule wins only because it is BEFORE the Number pattern
        (num = $ => $ > 41) => accept,

        (num = Number) => 3,
        _ => reject,
      ),
      accept,
    )
  })

  it('should throw Error if guard function does not return Boolean', () => {
    assert.throws(() => {
      wavematch('foo')((str = str => 'lul') => 'not gonna happen pal')
      wavematch('foo')((str = str => 42) => 'not gonna happen pal')
      wavematch('foo')((str = str => ({})) => 'not gonna happen pal')
      wavematch('foo')((str = str => () => {}) => 'not gonna happen pal')
      wavematch('foo')((str = str => /lmao/) => 'not gonna happen pal')
      wavematch('foo')((str = str => []) => 'not gonna happen pal')
    }, Error)
  })
})
