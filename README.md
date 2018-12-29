> Remember when JavaScript had pattern matching? Me neither, so I made it:

## Introduction

Wavematch is a control flow mechanism for JavaScript.
It provides pattern matching, a kind of type testing based on the shape of the input.
Branches of code are evaluated only if certain conditions are satisfied.

```javascript
let result = wavematch(random(0, 5))(
  (n = 0) => 'zero',
  (n = 1) => 'one',
  (n = 2) => 'two',
  _       => 'otherwise'
)
```

## Install

```sh
yarn add wavematch
```

## Matching Standard Types

Use constructors for type-based matching:

```javascript
let map = (fn, value) => wavematch(fn, value)(
  (fn, arr = Array) => arr.map(fn),
  (fn, obj = Object) => Object.keys(obj).reduce((result, key) => {
    result[key] = fn(obj[key], key)
    return result
  }, {})
)

map(num => num * 2, [ 1, 2, 3 ]) //=> [ 2, 4, 6 ]
map(val => val.toUpperCase(), { name: 'swift' }) //=> { name: 'SWIFT' }
```

## Matching Object Props

Use plain objects as a pattern to match against properties of object data:

> Objects must be [valid JSON5](https://json5.org/).

```javascript
wavematch({ isDone: false, error: Error('oh no') })(
    (obj = { isDone: false }) => {
      // do stuff
    }
)
```

```javascript
let assertShape = obj => wavematch(obj)(
  (shape = { foo: Number }) => {}, // empty function body skips is a no-op/skip
  _ => { throw Error() }
)
assertShape({ foo: 1 })
assertShape({ foo: {} }) // Error due to `foo` prop not being a Number
```

Destructure the object using the desired key as the argument name:

```javascript
let data = { isDone: false, error: Error() }

wavematch(data)(
  (obj = { isDone: false }) => neverInvoked(),
  (isDone = true) => getsInvoked()
)
```

Destructure the input object via the argument name _and_ match an object pattern:

```javascript
wavematch({ foo: { bar: 42 } })(
  (foo = { bar: 42 }) => {}
  _ => {}
```

## Matching Class Types

Use the class name as a pattern to match custom data types:

```javascript
class Person {}

wavematch(new Person())(
  (p = Person) => {
    console.log('Is a Person')
  },
  _ => {
    console.log('Not a Person')
  }
)
```

```javascript
function Car() {}

let carInstance = new Car()

wavematch(carInstance)(
  (c = Car) => {}
)
```

## Match Guards

Guards are boolean expressions for conditional behavior:

```javascript
let fib = wavematch.create(
  (n = 0 | 1) => n,
  // if (n > 1)
  (n = $ => $ > 1) => fib(n - 1) + fib(n - 2)
)
```

```javascript
wavematch(await fetch(url))(
  (response = { status: 200 }) => response,
  (response = $ => $.status > 400) => Error(response)
)
```

> The `({ prop }) => {}` syntax can _not_ be used for guard functions (due to being invalid [json5](https://json5.org/)).

## Match Unions

Use `|` to match multiple patterns:

```javascript
let value = random(0, 10)

wavematch(value)(
  (other = 2 | 4 | 6) => {
    console.log('two or four or six!')
  },
  _ => {
    console.log('not two or four or six')
  }
)
```

```javascript
wavematch(await fetch(url))(
  (response = { status: 200 } | { ok: true }) => response,
  (response = $ => $.status > 400) => Error(response)
)
```

```javascript
let parseArgument = arg => wavematch(arg)(
  (arg = '-h' | '--help') => displayHelp(),
  (arg = '-v' | '--version') => displayVersion(),
  _ => unknownArgument(arg)
)
```


## Wildcard Pattern

The wildcard pattern `_` matches all input arguments.
- Binds `undefined` to the parameter
- Should be the last rule provided

```javascript
let number = wavematch(random(0, 100))(
  (n = 99)          => 'ninety-nine',
  (n = $ => $ > 30) => 'more than thirty',
  _                 => 'who knows'
)
```

## Limitations

Things that can **not** be done:

```javascript
let value = 3
let matched = wavematch(77)(
  (arg = value) => 'a', // `value` throws a ReferenceError
  _ => 'b'
)
```

> **Fix:** If possible, replace the variable with its value.

```javascript
function fn() {}
let matched = wavematch('bar')(
  (arg = fn) => 'hello',
      // ^^ `fn` throws a ReferenceError
)
```

> **Fix:** If possible, replace the function with an arrow function returning a boolean.

```javascript
wavematch({ age: 21.5 })(
  (obj = { age: Number }) => 'got a number',
             // ^^^^^^ Invalid JSON5 here throws the error!
  // Fix: Use desired key name to match and destructure:
  (age = Number) => 'got a number!'
)
```

```javascript
wavematch('foo')(
  (_ = !Array) => {},
    // ^^^^^^ Cannot use `!` operator
  // Fix: Use a match guard like so:
  (_ = $ => !Array.isArray($)) => {},
  _ => {}
)
```

## Examples

```javascript
let zip = (xs, ys) => wavematch(xs, ys)(
  (_, ys = []) => [],
  (xs = [], _) => [],
  ([x, ...xs], [y, ...ys]) => [x, y].concat(zip(xs, ys))
)
zip(['a', 'b'], [1, 2]) //=> ['a', 1, 'b', 2]
```

```javascript
let zipWith = wavematch.create(
  (_, xs = [], __) => [],
  (_, __, ys = []) => [],
  (fn, [x, ...xs], [y, ...ys]) => [fn(x, y)].concat(zipWith(fn, xs, ys))
)
zipWith((x, y) => x + y, [1, 3], [2, 4]) //=> [3, 7]
```

*More examples are in the [test](test/) directory.*

### Next

- Fix todos in codebase
- File issue about branch bodies not being able to use rest/spread operator
- Fix `custom-type.spec.js` test
