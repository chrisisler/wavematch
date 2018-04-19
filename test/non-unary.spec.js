const assert = require('assert')
const wavematch = require('../lib/index.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch non-unary arguments specification', () => {
  it('array#reduce', () => {
    const reduce = (fn, reduced, array) => wavematch(fn, reduced, array)(
      (fn, reduced, array = Array) => array.reduce(fn, reduced),
      _ => reject
    )
    const sum = numbers => reduce((summed, num) => summed + num, 0, numbers)

    eq(sum([5, 5, 5]), 15)
  })

  it('array#filter', () => {
    const filter = (predicate, value) => wavematch(predicate, value)(
      (predicate = Function, value = Array) => {
        return value.filter(predicate)
      },
      (predicate = Function, value = Object) => {
        return Object.keys(value).reduce((reducedObject, key) => {
          if (predicate(value[key], key, reducedObject)) {
            reducedObject[key] = value[key];
          }
          return reducedObject
        }, {})
      },
      _ => reject
    )

    assert.deepEqual(
      filter((value, key) => value === 3 || key == 'id', { foo: 0, id: 'yes' }),
      { id: 'yes' }
    )

    assert.deepEqual(
      filter(n => n % 2 === 0, [1, 1.5, 2].map(n => n * 2)),
      [2, 4]
    )
  })

  it('array#map', () => {
    const map = (fn, array) => wavematch(fn, array)(
      (fn = Function, array = Array) => array.map(fn),
      _ => reject
    )

    assert.deepEqual(
      map(x => x * 2, [1, 2, 3]),
      [2, 4, 6]
    )
  })

  it('array#zip', () => {
    const zip = (xs, ys) => wavematch(xs, ys)(
      (xs, ys = []) => [],
      (xs = [], ys) => [],
      (xs, ys) => {
        return [xs[0], ys[0]].concat(zip(xs.slice(1), ys.slice(1)))
      },
      _ => reject
    )

    assert.deepEqual(
      zip([1, 2, 3], ['a', 'b', 'c']),
      [1, 'a', 2, 'b', 3, 'c']
    )
  })

  it('array#zipWith', () => {
    const zipWith = (fn, xs, ys) => wavematch(fn, xs, ys)(
      (fn, xs = [], ys) => [],
      (fn, xs, ys = []) => [],
      (fn, xs, ys) =>
        [fn(xs[0], ys[0])].concat(zipWith(fn, xs.slice(1), ys.slice(1))),
      _ => reject
    )

    assert.deepEqual(
      zipWith((x, y) => x + y, [1, 1, 1], [1, 1, 1]),
      [2, 2, 2]
    )

    const zip = (xs, ys) => zipWith((x, y) => [x, y], xs, ys)
    const flat = arr => arr.reduce((xs, x) => xs.concat(x), [])

    assert.deepEqual(
      flat(zip([1, 2, 3], ['a', 'b', 'c'])),
      [1, 'a', 2, 'b', 3, 'c']
    )
  })
})
