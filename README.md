# Wavematch

> Control flow operator for matching values against patterns.

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

## Matching Types

Use constructors for type-based matching.

```javascript
let toDate = s => wavematch(s)(
  (value = Date) => value,
  (value = String) => new Date(value)
)
```

```javascript
let map = (fn, x) => wavematch(fn, x)(
  (fn, x = Array) => x.map(fn),
  (fn, x = Object) => Object.values(x).map(fn)
)
```

## Matching Objects

Use plain objects as parameter defaults to match object properties.

```javascript
let data = { isDone: false, error: Error() }

wavematch(data)(
  (obj = { isDone: true }) => awesome()
)
```

```javascript
let assertShape = obj => wavematch(obj)(
  (shape = { foo: Number }) => {},
  _ => throw Error()
)
assertShape({ foo: 1 })
assertShape({ foo: {} }) // Error!
```

> Objects must be [valid JSON5](https://json5.org/).

```javascript
let data = { isDone: false, error: Error() }

wavematch(data)(
  (obj = { isDone: true }) => awesome(),

  // or destructure the object using the desired key as the argument name
  (isDone = true) => awesome()
)
```

## Matching Classes

Use custom type constructors to match custom types.

```javascript
class Person {}
let alex = new Person()

wavematch(alex)(
  (p = Person) => {
    console.log('Is a Person')
  },
  _ => {
    console.log('Not a Person')
  }
)
```

## Match Guards

Guards are boolean expressions for conditional behavior.

```javascript
let fib = n => wavematch(n)(

  // if (n === 0 || n === 1)
  (n = 0 | 1) => n,

  // if (n > 1)
  (n = $ => $ > 1) => fib(n - 1) + fib(n - 2)
)
```

```javascript
let fetchy = async url => wavematch(await fetch(url))(
  (res = { status: 200 }) => res,
  (res = $ => $.status > 400) => Error(res)
)
```

> The `({ prop }) => {}` syntax can _not_ be used for guard functions (due to being invalid [json5](https://json5.org/)).

## Match Unions

Use `|` to match multiple patterns.

```javascript
let value = random(0, 10)

wavematch(value)(
  (other = 2 | 4 | 6) => {
    console.log('two or four or six!')
  },
  other => {
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

## Wildcard Pattern

The wildcard pattern `_` matches all input arguments.
- Binds `undefined` to the underscore character
- Should be the last rule provided

```javascript
let number = wavematch(random(0, 100))(
  (n = 99)          => 'ninety-nine',
  (n = $ => $ > 30) => 'more than thirty',
  _                 => 'who knows'
)
```

**More complex examples are included in the [tests](test/) directory.**

## Limitations

Things that can **not** be done:

```javascript
let value = 3
let matched = wavematch(77)(
  (arg = value) => 'a', // `value` throws a ReferenceError
  _ => 'b'
)
```

> _Workaround:_ If possible, replace the variable with its value.

```javascript
function fn() {}
let matched = wavematch('bar')(
  (arg = fn) => 'hello', // `fn` throws a ReferenceError
)
```

> _Workaround:_ If possible, replace the function with an inline arrow function returning a boolean.

```javascript
wavematch({ age: 21 })(
  (obj = { age: Number }) => 'got a number', // invalid JSON5

  // Workaround: To extract a prop from an object, use the key name as the argument name.
  (age = Number) => 'got a number!'
)
```

## Examples

```javascript
let zip = (xs, ys) => wavematch(xs, ys)(
  (xs, ys = []) => [],
  (xs = [], ys) => [],
  ([x, ...xs], [y, ...ys]) => [x, y].concat(zip(xs, ys))
)
zip(['a', 'b'], [1, 2]) //=> ['a', 1, 'b', 2]
```

```javascript
let zipWith = (f, xs, ys) => wavematch(f, xs, ys)(
  (f, xs = [], ys) => [],
  (f, xs, ys = []) => [],
  (f, [x, ...xs], [y, ...ys]) => [f(x, y)].concat(zipWith(f, xs, ys))
)
zipWith((x, y) => x + y, [1, 3], [2, 4]) //=> [3, 7]
```

```javascript
wavematch([ 1, 2, 3 ].find(num => num === 5)) (
  
)
```

## Roadmap

- Fix array tests
- Fix union tests: (`(value = null | Person) => {}`)
- Write void tests (for matching null and undefined together)
- Support esmodules
- Update config
  - Remove flow-remove-types dependency and use babel instead (see github.com/chrisisler/task)
