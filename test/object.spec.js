const assert = require('assert')
const wavematch = require('../build/index.js')
const { accept, reject, eq } = require('./shared.js')

// any object can be parsed by wavematch if it is valid json5
describe('wavematch object specification', () => {
  // equality comparisons are handled by lodash's `isEqual`
  it('should match destructured defaults with exact values', () => {
    const matchedUnary = wavematch({ x: 1, y: 2 })(
      (value = { x: 1, y: 2 }) => accept,
      _ => reject
    )
    eq(matchedUnary, accept)

    const matchedName = wavematch({ name: 'chris' })(
      (foo = { name: 'chris' }) => accept,
      _ => reject
    )
    eq(matchedName, accept)
  })

  it('should match object patterns with more keys', () => {
    const twoKeys = wavematch({ a: 1, b: 2 })(
      (arg = { a: 1 }) => 0,
      (arg = { a: 1, b: 2 }) => accept,
      _ => 1
    )
    eq(twoKeys, accept)

    const threeKeys = wavematch({ a: 1, b: 2, c: 3 })(
      (arg = { a: 1 }) => reject,
      (arg = { a: 1, b: 2 }) => reject,
      (arg = { a: 1, b: 2, c: 3 }) => accept,
      _ => reject
    )
    eq(threeKeys, accept)

    const notEnoughKeys = wavematch({ a: 1, b: 2, c: 3 })(
      (arg = { a: 1 }) => reject,
      (arg = { a: 1, b: 2 }) => accept,
      _ => reject
    )
    eq(notEnoughKeys, accept)

    const tooManyKeys = wavematch({ a: 1 })(
      (arg = {}) => reject,
      (arg = { a: 1, b: 2 }) => reject,
      _ => accept
    )
    eq(tooManyKeys, accept)
  })

  it('should match nested objects', () => {
    const matchedObject = wavematch({ obj: { foo: 'bar' } })(
      (xyz = { obj: { foo: 'bar' } }) => accept,
      _ => reject
    )
    eq(matchedObject, accept)
  })

  it('should match using constructor functions', () => {
    const foo = wavematch({ foo: 'bar' })(
      (o = Object) => accept,
      _ => reject
    )
    eq(foo, accept)
  })

  // TODO .only
  it('should respect match specificity', () => {
    const lowSpecificity = wavematch({ x: 1, y: 2 })(
      (o = { x: 1 }) => accept,
      _ => reject
    )
    eq(lowSpecificity, accept)

    const constructorAfter1 = wavematch({ x: 1, y: 2 })(
      (o = { x: 1 }) => accept,
      (o = Object) => reject,
      _ => reject
    )
    eq(constructorAfter1, accept)

    const constructorAfter2 = wavematch({ x: 1, y: 2 })(
      (o = { x: 1 }) => reject,
      (o = { x: 1, y: 2 }) => accept,
      (o = Object) => reject,
      _ => reject
    )
    eq(constructorAfter2, accept)

    const constructorBeforeMostSpecific = wavematch({ x: 1, y: 2 })(
      (o = { x: 1 }) => reject,
      (o = Object) => reject,
      (o = { x: 1, y: 2 }) => accept,
      _ => reject
    )
    eq(constructorBeforeMostSpecific, accept)
  })

  it('should match empty objects', () => {
    const empty = wavematch({})(
      (obj = { xyz: 'nope' }) => reject,
      (obj = {}) => accept,
      (obj = { a: 1 }) => reject,
      _ => reject
    )
    eq(empty, accept)
  })

  it('should work for nested matches with constructor functions', () => {
    const result = wavematch({ obj: {} })(
      (a = Object) => wavematch(a.obj)(
        (b = Object) => accept,
        _ => reject
      ),
      _ => reject
    )
    eq(result, accept)
  })

  it('should match empty object with only the object constructor', () => {
    const emptyInputObjectOnlyConstructor = wavematch({})(
      (obj = {}) => accept,
      _ => reject
    )
    eq(emptyInputObjectOnlyConstructor, accept)
  })

  it('should match specific keys', () => {
    const mockRender = mockState => wavematch(mockState)(
      (state = { error: true })   => 'error-state',
      (state = { loading: true }) => 'loading-state',
      _                           => 'success-state'
    )
    eq(mockRender({ error: true }), 'error-state')
    eq(mockRender({ loading: true }), 'loading-state')

    eq(mockRender({}), 'success-state')
    eq(mockRender({ foo: 'bar' }), 'success-state')
    eq(mockRender({ a: 1 }), 'success-state')
  })

  // it.only('should accept constructor as value', () => {
  //   const matched = wavematch({ error: new Error() })(
  //     // there has to be a way to do this
  //     (obj = { error: Error }) => accept,
  //     (obj = { loading: true }) => reject,
  //     _ => reject
  //   )
  //   eq(matched, accept)
  // })
})
