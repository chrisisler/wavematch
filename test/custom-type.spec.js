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

  // TODO
  // it('should work for multiple rules matching user defined data types', () => {
  //   class Coin {}
  //   class Penny extends Coin {}
  //   class Nickel extends Coin {}

  //   // let cents = wavematch.create(
  //   //   (coin = Penny) => 1,
  //   //   (coin = Nickel) => 5,
  //   //   _ => reject
  //   // )

  //   // let penny = new Penny()
  //   // let pennyMatched = cents(penny)
  //   // eq(pennyMatched, 1)

  //   // let nickel = new Nickel()
  //   // let nickelMatched = cents(nickel)
  //   // eq(nickelMatched, 5)

  //   // TODO
  //   class UltraCoin extends Coin {}

  //   let otherCents = wavematch.create(
  //     (coin = Penny) => 1,
  //     (coin = Coin) => 42, // Any other coin besides Penny
  //     _ => reject
  //   )

  //   let match = otherCents(new UltraCoin())
  //   eq(match, 42)
  // })
})
