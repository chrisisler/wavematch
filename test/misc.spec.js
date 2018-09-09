const assert = require('assert')
const wavematch = require('../lib/wavematch.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch miscellaneous specification', () => {
  it('should throw if default is out of scope', () => {
    assert.throws(() => {
      const foo = 'foo'
      const match = wavematch(foo)(
        (arg = foo) => accept,
        _ => accept
      )
    }, Error)
  })

  it('should throw if invalid JSON5', () => {
    assert.throws(() => {
      wavematch('doesnt matter')(
        (x = Function) => 0,
        (o = { k: Error }) => 1,
        _ => 2
      )
    }, Error)
  })

  it('null behavior', () => {
    let nullTest = (value, acceptOrReject) => eq(wavematch(value)(
      (arg = null) => accept,
      _ => reject
    ), acceptOrReject)

    nullTest(null, accept)
    nullTest(undefined, reject)
  })

  it('undefined behavior', () => {
    let undefinedTest = (value, acceptOrReject) => eq(wavematch(value)(
      (arg = undefined) => accept,
      _ => reject
    ), acceptOrReject)

    undefinedTest(undefined, accept)
    undefinedTest(null, reject)
  })

  describe('should allow destructuring', () => {
    // todo
    // describe('object destructuring', () => {
    // })

    describe('array destructuring', () => {
      it('head-rest pattern', () => {
        const match = wavematch([1, 2, 3])(
          ([head, ...rest]) => accept,
          _ => reject
        )
        eq(match, accept)
      })

      it('array#zip destructured', () => {
        const zip = (xs, ys) => wavematch(xs, ys)(
          (xs, ys = []) => [],
          (xs = [], ys) => [],
          ([x, ...xs], [y, ...ys]) => [x, y].concat(zip(xs, ys)),
          _ => reject
        )
        assert.deepEqual(
          zip([1, 2, 3], ['a', 'b', 'c']),
          [1, 'a', 2, 'b', 3, 'c']
        )
      })

      it('array#zipWith destructured', () => {
        const zipWith = (fn, xs, ys) => wavematch(fn, xs, ys)(
          (fn, xs = [], ys) => [],
          (fn, xs, ys = []) => [],
          (fn, [x, ...xs], [y, ...ys]) => [fn(x, y)].concat(zipWith(fn, xs, ys)),
          _ => reject
        )

        assert.deepEqual(
          zipWith((x, y) => x + y, [1, 1, 1], [1, 1, 1]),
          [2, 2, 2]
        )

        assert.throws(() => {
          zipWith()
        })

        const zip = (xs, ys) => zipWith((x, y) => [x, y], xs, ys)
        const flattenOnce = arr => arr.reduce((xs, x) => xs.concat(x), [])

        assert.deepEqual(
          flattenOnce(zip([1, 2, 3], ['a', 'b', 'c'])),
          [1, 'a', 2, 'b', 3, 'c']
        )
      })
    })
  })

  it('should bind undefined to underscore named parameters', () => {
    let match = wavematch(1, 2, 3)(
      (n1, _, n3) => {
        if (_ === void 0) {
          return accept
        }
      },
      _ => reject
    )
    eq(match, accept)

    let match2 = wavematch(1, 2, 3)(
      (n1, _, __) => {
        if (_ === void 0 && __ === void 0) {
          return accept
        }
      },
      _ => reject
    )
    eq(match2, accept)
  })

  it('should throw for out of scope variables used as pattern', () => {
    let fn = () => wavematch('foo')(
      (irrelevant = outOfScopeVarNameWillCauseError) => 42,
      _ => 147
    )
    assert.throws(fn)

    let fn2 = () => wavematch('bar')(
      (_ = willCauseErr) => {}
    )
    assert.throws(fn2)
  })
})
