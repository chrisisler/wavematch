const assert = require('assert')
const wavematch = require('../lib/index.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch miscellaneous specification', () => {
  it('should throw if default is out of scope', () => {
    assert.throws(() => {
      const foo = 'foo'
      // prettier-ignore
      const match = wavematch(foo)(
        (arg = foo) => accept,
        _ => accept
      )
    }, Error)
  })

  it('should allow destructuring', () => {
    // prettier-ignore
    const match = wavematch([1, 2, 3])(
      ([head, ...rest]) => accept,
      _ => reject
    )
    eq(match, accept)
  })

  // prettier-ignore
  const zipDestructure = (xs, ys) => wavematch(xs, ys)(
    (xs, ys = []) => [],
    (xs = [], ys) => [],
    ([x, ...xs], [y, ...ys]) => [x, y].concat(zip(xs, ys)),
    _ => reject
  )
  // prettier-ignore
  assert.deepEqual(
    zipDestructure([1, 2, 3], ['a', 'b', 'c']),
    [1, 'a', 2, 'b', 3, 'c']
  )
})
