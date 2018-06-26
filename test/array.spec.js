const assert = require('assert')
const wavematch = require('../lib/wavematch.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch array specification', () => {
  const emptyArray = []

  it('should match Array constructor', () => {
    const matchArray = array => wavematch(array)(
      (arg = Array) => accept,
      _ => reject
    )
    eq(matchArray(emptyArray), accept)
    eq(matchArray([1]), accept)
    eq(matchArray([1, 2]), accept)
    eq(matchArray([1, 2, 3]), accept)
    eq(matchArray([{}]), accept)
    eq(matchArray([function() {}]), accept)
    eq(matchArray(['foo', 'bar']), accept)
    eq(matchArray('abcde'.split('')), accept)

    // this tests the `isArrayLike` function in array matching cases
    ;(function() {
      eq(matchArray(arguments), accept)
    })()
  })

  it('should match empty array', () => {
    const empty = _emptyArray => wavematch(_emptyArray)(
      (array = []) => accept,
      _ => reject
    )
    eq(empty([]), accept)
    eq(empty(new Array()), accept)
    eq(empty(new Array(0)), accept)
  })

  it('should prefer to match array destructuring over array constructor', () => {
    const emptyFirst = wavematch(emptyArray)(
      (a = []) => accept,
      (a = Array) => reject,
      _ => reject
    )
    const constructorFirst = wavematch(emptyArray)(
      (a = Array) => reject,
      (a = []) => accept,
      _ => reject
    )
    eq(emptyFirst, accept)
    eq(constructorFirst, accept)
  })

  it('should match empty arrays with only the array constructor', () => {
    const emptyInputOnlyConstructor = wavematch(emptyArray)(
      (arr = Array) => accept,
      _ => reject
    )
    eq(emptyInputOnlyConstructor, accept)
  })

  it('should match arrays whose destructured values are the same', () => {
    const notTheSameElements = wavematch([1, 2])(
      (nope = ['k', 'i']) => reject,
      _ => accept
    )
    eq(notTheSameElements, accept)
  })

  it('should reject patterns which describe a superset of the input', () => {
    const rejectMe = wavematch([1, 2])(
      (arr = [1, 2, 3, 4]) => reject,
      _ => accept
    )
    eq(rejectMe, accept)

    const constructorSavesTheDay = wavematch([1, 2])(
      (arr = [1, 2, 3, 4]) => reject,
      (arr = Array) => accept,
      _ => reject
    )
    eq(constructorSavesTheDay, accept)
  })

  // TODO decide what this behavior should be
  it.only('should match arrays with a subset of the elements', () => {
    console.log('TODO - should match arrays with a subset of the elements')
    const threeItems = [1, 2, 3]

    // const one = wavematch(threeItems)(
    //   (arr = [ 1 ]) => accept,
    //   _ => reject
    // )
    // eq(one, accept)

    // const two = wavematch(threeItems)(
    //   (arr = [1, 2]) => accept,
    //   _ => reject
    // )
    // eq(two, accept)

    // const oneAndTwo = wavematch(threeItems)(
    //   (one = [1]) => reject,
    //   (two = [1, 2]) => reject,
    //   _ => accept
    // )
    // eq(oneAndTwo, accept)
  })

  it('should match arrays with multiple values', () => {
    const twoSame = wavematch([ {}, {} ])(
      (xs = [ {}, {} ]) => accept,
      _ => reject
    )
    eq(twoSame, accept)

    const twoDifferent = wavematch(['x', 3])(
      (nope = [,]) => reject,
      (alsoNope = [1, 2]) => reject,
      (no = ['x', 0]) => reject,
      (yes = ['x', 3]) => accept,
      _ => reject
    )
    eq(twoDifferent, accept)

    const twoDifferentReOrdered = wavematch(['x', 3])(
      (nope = [,]) => reject,
      (yes = ['x', 3]) => accept,
      (no = ['x', 0]) => reject,
      (alsoNope = [1, 2]) => reject,
      _ => reject
    )
    eq(twoDifferentReOrdered, accept)
  })

  it('should match arrays with respect to internal order', () => {
    const foo = wavematch([1, 9, 5])(
      (outOfOrder = [5, 9, 1]) => reject,
      (duplicate = [1, 1, 5]) => reject,
      (outOfOrder = [1, 5, 9]) => reject,
      (correct = [1, 9, 5]) => accept,
      _ => reject
    )
    eq(foo, accept)
  })

  it('should match arrays of strings', () => {
    const arrayOfStrings = wavematch(['foo', 'bar'])(
      (wrong = ['x', 'y']) => reject,
      (wrong = ['', '']) => reject,
      (right = ['foo', 'bar']) => accept,
      (wrong = ['bar', 'foo']) => reject,
      new Function(`wrong = [ "'i'", "'j'" ]`, `return "${reject.valueOf()}"`),
      _ => reject
    )
    eq(arrayOfStrings, accept)

    const arrayOfStringsWithConstructor = wavematch(['foo'])(
      (right = Array) => accept,
      _ => reject
    )
    eq(arrayOfStringsWithConstructor, accept)
  })

  it('should not match non-empty inputs to empty array patterns', () => {
    const match = wavematch('arg1', [1])(
      (foo, array = []) => reject,
      _ => accept
    )
    eq(match, accept)
  })

  it('should reject invalid empty arrays', () => {
    const empty = array => wavematch(array)(
      (array = []) => accept,
      _ => reject
    )

    assert.deepEqual(empty(''), reject)
    assert.deepEqual(empty(1), reject)
    assert.deepEqual(empty([1]), reject)
    assert.deepEqual(empty(['']), reject)
    assert.deepEqual(empty([{}]), reject)
    assert.deepEqual(empty([[]]), reject)
    assert.deepEqual(empty([() => {}]), reject)

    assert.deepEqual(empty([]), accept)
  })

  // TODO: should not work with Boolean pattern
  // it('should not work with Boolean pattern', () => {
  //   let matched = wavematch([1])(
  //     (x = Boolean) => accept,
  //     _ => reject
  //   )
  //   eq(matched, accept)
  // })

  // it('should match any element type', () => {
  //   const array = []
  //   const fn = _ => {} // cannot contain parenthesis or else SyntaxError
  //   const number = 1
  //   const string = "'i am a string'" // string must be quoted twice
  //   const boolean = false

  //   // const S = new Set()
  //   // const M = new Map()

  //   const elements = [array, fn, number, string]

  //   elements.forEach(element => {
  //     console.log('element is:', element)

  //     const matchElement = wavematch(element)(
  //       new Function(`arg = [${element}]`, `return "${accept}"`),
  //       (arg = Array) => reject,
  //       _ => reject
  //     )
  //     eq(matchElement, accept)
  //   })

  //   eq(wavematch(elements)(
  //     (args = Array) => accept,
  //     _ => reject
  //   ), accept)
  // })
})
