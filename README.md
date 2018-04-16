# Summary
[summary]: #summary

```javascript
let factorial = n => wavematch(n)(
  (n = 0) => 1,
  n       => n * factorial(n - 1)
)
factorial(5) //=> 120
```

```javascript
let isUsd = item => wavematch(item)(
  (arg = { options: { currency: 'USD' } }) => true,
  _                                        => false
)
isUsd({ value: 42, options: { currency: 'USD' } }) //=> true
isUsd({ value: 42, options: { currency: 'ARS' } }) //=> false
```

```javascript
// In a React app
let rendered = wavematch(this.state)(
  (state = { error: true })  => <ErrorView />,
  (state = { loading: true }) => <LoadingView />,
  _                           => <SuccessView data={this.state.data} />
)
```

```javascript
let zip = (xs, ys) => wavematch(xs, ys)(
  (xs, ys = []) => [],
  (xs = [], ys) => [],
  ([x, ...xs], [y, ...ys]) => [x, y].concat(zip(xs, ys))
)
```

```javascript
let fib = n => wavematch(n)(
  (n = 0) => 0,
  (n = 1) => 1,
  n       => fib(n - 1) + fib(n - 2)
)
```

```javascript
let zipWith = (f, xs, ys) => wavematch(f, xs, ys)(
  (f, xs = [], ys) => [],
  (f, xs, ys = []) => [],
  (f, [x, ...xs], [y, ...ys]) => [f(x, y)].concat(zipWith(f, xs, ys))
)
```

```javascript
let response = wavematch(await fetch(url))(
  (res = { status: 200 }) => 'request succeeded',
  (res = { status: 404 }) => 'no value at url',
  (res = res => res.status >= 400) => `unknown request status: ${res.status}`,
  _ => 'who knows honestly'
)
```

```javascript
// Error example
// nested example
// async/await example
// flow types example
// typescript example
```

> What does this do?
Wavematch is a control flow operator for modern JavaScript.

Compare values against a series of patterns and execute code based on which pattern matches.
Patterns can be made up of literal values, type checks, conditional guards, and wildcards.

> How would it be used?


## Background
[background]: #background

What is pattern matching?
Point out previous discussions with (bullet-point) links.
How is this different than before?
What do you need to get started? Previous knowledge?


## Motivation
[motivation]: #motivation

Why are we doing this?
What use cases does it support?
What is the expected outcome?
(What problem does this (new thing/solution) solve?)

## Syntax

The order of rules is important:

```javascript
let result = wavematch(42)(
  (n = Number) => 'yes',
  (n = $ => $ === 42) => 'no'
)
result //=> 'yes'

let result = wavematch(42)(
  (n = $ => $ === 42) => 'yes'
  (n = Number) => 'no',
)
result //=> 'yes'
```

## Limitations
[limitations]: #limitations

- All patterns which describe objects must be valid [JSON5](json5.org)
- Can't do much when argument is destructured
