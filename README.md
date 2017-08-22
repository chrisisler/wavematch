<h1 align='center'>Wavematch</h1>
<h3 align='center'><strong>JS pattern matching</strong></h3>

<p align='center'>
Compare input data against patterns and descriptions to check for compatible matches.
If a match is compatible, the corresponding logic is executed. Return a fixed value
or apply a function to the arguments.
</p>

```JavaScript
const factorial = rematch({
    0: 1,
    default: (n) => n * factorial(n - 1)
})
```

<h2 align='center'>Usage</h2>

<h4 align='center'>Match Strings</h4>

```javascript
// Match an empty string, either way works.
const myFunc = rematch({
    '""': () => //...
    "''": () => //...
})

// Match a literal string, _case-sensitive_.
const myFunc = rematch({
    'andy': () => //...
    'foo': () => //...
})
```

<h4 align='center'>Match Numbers</h4>

```javascript
// Match exact numbers.
const myFunc = rematch({
    0: 'zero',
    5: 'five'
})
```

<h4 align='center'>Match Null and Undefined</h4>

```javascript
const myFunc = rematch({
    null: () => //...
    undefined: () => //...
})
```

<h4 align='center'>Match Regular Expressions</h4>

```javascript
const myFunc = rematch({
    '/foo/': () => //...
    default: () => //...
})
```

<h4 align='center'>Match Arrays</h4>

```javascript
const myFunc = rematch({
    // Match an empty array
    '[]': () => //...

    // Match an array of length 1
    '[ blah ]': () => //...

    // Match an array of length 2
    '[ blah, foo ]': () => //...

    // Match an array of arbitrary length
    '[...]': () => //...

    //TODO
    // Match an array of at least length 1
    '[ x, ... ]': () => //...

    //TODO
    // Match an array of at least length 2
    '[ x, y, ... ]': () => //...
})
```

<h4 align='center'>Match Objects</h4>

```javascript
const myFunc = rematch({
    //TODO
    // Match an empty object
    '{}': () => //...

    // Match an object with *only* the key `blah`
    '{ blah }': () => //...

    // Match an object with keys `age` and `name`
    '{ age, name }': () => //...

    // Match an any non-empty object
    '{...}': () => //...

    //TODO
    // Match an object with key `x` and optionally more
    '{ x, ... }': () => //...

    //TODO
    // Match an object with keys `x`, `y`, and optionally more
    '{ x, y, ... }': () => //...
})
```

<h4 align='center'>Match Booleans</h4>

```javascript
const myFunc = rematch({
    false: () => //...
    true: () => //...
})
```

<h4 align='center'>Match Functions</h4>

todo

## To Do

- Add examples to README (wip).
- Add tests for Number, regexp, empty obj/arrary, and error throwing.
- Add tests for floats `3.2`.
- Add tests for return a fixed value instead of a function.
- Add support for parameter type checking.
- Add support for an `Any` type, in `pattern.types` (is this a good idea?).
- Add support for at least N obj/arr
- Add support for recursive functions like `zipWith`.
- Add support for empty objects.
- Add support for function matching.
- Add support for empty string matching, either way.
- In index.js, provide better error messages by supplying `fn.name` to the `Error` call.
