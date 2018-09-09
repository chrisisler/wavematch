const assert = require('assert')
const wavematch = require('../lib/wavematch.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch custom types specification', () => {
  it('should work for `class` case', () => {
    class Person {}
    let person = new Person()

    let matchPerson = wavematch(person)(
      (p = Person) => accept,
      _ => reject
    )

    eq(matchPerson, accept)
  })

  it('should work for `function` case', () => {
    function Car() {}
    let car = new Car()

    eq(wavematch(car)(
      (arg = Car) => accept,
      _ => reject
    ), accept)
  })

  it('should work for `class extends` child case', () => {
    class A {}
    class B extends A {}
    let b = new B()

    eq(wavematch(b)(
      (arg = B) => accept,
      _ => reject
    ), accept)
  })

  it('should work for `class extends` parent case ', () => {
    class A {}
    class B extends A {}
    let b = new B()

    eq(wavematch(b)(
      (arg = A) => accept,
      _ => reject
    ), accept)
  })
})
