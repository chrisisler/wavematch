# Wavematch

> Control flow operator for matching values against patterns.

```javascript
let number = wavematch(random(0, 5))(
  (n = 0) => 'zero',
  (n = 1) => 'one',
  (n = 2) => 'two',
  _       => 'otherwise'
)
```

The input value is a random number between 0 and 5.
`number` is assigned to the result of whichever rule matches the input first.
Four rules are given, the last being a wildcard rule providing default behavior.

## Install

```sh
yarn add wavematch
```

## Matching Types

Use constructors in place of patterns for type-based matching.

```javascript
let toDate = dateString => wavematch(dateString)(
  (value = Date)   => value,
  (value = String) => new Date(value)
)
```

```javascript
let map = (fn, x) => wavematch(fn, x)(
  (fn, x = Array)  => x.map(fn),
  (fn, x = Object) => Object.keys(x).map(key => fn(x[key]))
)
```

## Match Guards

Guards are boolean expressions used to match certain conditions.

```javascript
let number = wavematch(random(0, 100))(
  (n = 99)          => 'ninety-nine',
  (n = $ => $ > 30) => 'more than thirty',
  _                 => 'who knows'
)
```

```javascript
let fib = n => wavematch(n)(
  (n = 0) => 0,
  (n = 1) => 1,
  // when n > 1
  (n = $ => $ > 1) => fib(n - 1) + fib(n - 2)
)
```

## Wildcard Pattern

The wildcard pattern `_` matches all input arguments.
It binds `undefined` to the underscore character.
The wildcard pattern should be the last rule provided.

## Limitations

These are all examples of things that can _not_ be done.

```javascript
let value = 3
let matched = wavematch(77)(
  (arg = value) => 'a', // `value` causes a ReferenceError
  _ => 'b'
)
```

> Workaround: If possible, replace the variable with its value.

```javascript
function fn() {}
let matched = wavematch('bar')(
  (arg = fn) => 'hello', // `fn` causes a ReferenceError
)
```

> Workaround: If possible, replace the function with a arrow function returning a boolean.

## FAQ

> I need a pattern for matching truthy values that aren't `true`.

Example:

```javascript
if (typeof groupOptions === "string") {
  groupOptions = { name: groupOptions };
} else if (!groupOptions) {
  groupOptions = { name: undefined };
}

groupOptions = wavematch(groupOptions)(
  (x = String) => ({ name: groupOptions }),
  (x = $ => !$) => ({ name: undefined })
)
```
