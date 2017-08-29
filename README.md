<h1 align='center'>Wavematch</h1>
<h3 align='center'><strong>JS pattern matching</strong></h3>

<p align='center'>
Compare input data against desired structures to check for compatibility.
If a match is compatible, the corresponding expression is executed.
Return a fixed value or apply a function to the arguments.
</p>

```JavaScript
const factorial = wavematch({
    0: 1,
    default: (n) => n * factorial(n - 1)
})
```

<h2 align='center'>Usage</h2>

<h4 align='center'>Match Strings</h4>

```javascript
// Match an empty string, either way works.
const myFunc = wavematch({
    '""': (...args) => ...
    "''": (...args) => ...
})

// Match a literal string, _case-sensitive_.
const myFunc = wavematch({
    'andy': (...args) => ...
    'foo': (...args) => ...
})
```

<h4 align='center'>Match Numbers</h4>

```javascript
// Match exact numbers.
const myFunc = wavematch({
    0: (...args) => ...
    5: (...args) => ...
})
```

<h4 align='center'>Match Null and Undefined</h4>

```javascript
const myFunc = wavematch({
    null: (...args) => ...
    undefined: (...args) => ...
})
```

<h4 align='center'>Match Regular Expressions</h4>

```javascript
const myFunc = wavematch({
    '/foo/': (...args) => ...
    default: (...args) => ...
})
```

<h4 align='center'>Match Arrays</h4>

```javascript
const myFunc = wavematch({
    // Match an empty array
    '[]': (...args) => ...

    // Match an array of length 1
    '[ blah ]': (...args) => ...

    // Match an array of length 2
    '[ blah, foo ]': (...args) => ...

    // Match an array of arbitrary length
    '[...]': (...args) => ...

    //TODO
    // Match an array of at least length 1
    '[ x, ... ]': (...args) => ...

    //TODO
    // Match an array of at least length 2
    '[ x, y, ... ]': (...args) => ...
})
```

<h4 align='center'>Match Objects</h4>

```javascript
// Use a single underscore character to match a key of any name.
// Use the exact (case-sensitive) word to match a key of that exact name.

const nonGreedy = wavematch({
    // Matches only the empty object.
    // Match an object with zero named keys and zero unnamed keys
    '{}':

    // Match an object with non-zero named keys and non-zero unnamed keys
    '{ x, _ }':
    '{ x, y, _, _ }':

    // Match an object with non-zero named keys and zero unnamed keys
    '{ x }':
    '{ x, y }':

    // Match an object with zero named keys and non-zero unnamed keys
    '{ _ }':
    '{ _, _ }':
})

const greedy = wavematch({
    // Matches any object ever (zero or more named keys and zero or more unnamed keys)
    '{...}':

    // Match an object with at least non-zero keys and at least non-zero unnamed keys
    '{ x, _, ... }':
    '{ x, y, _, _, ... }':

    // Match an object with at least non-zero named keys
    '{ x, ... }':
    '{ x, y, ... }':

    // Match an object with at least non-zero unnamed keys
    '{ _, ... }':
    '{ _, _, ... }':
})
```

<h4 align='center'>Match Booleans</h4>

```javascript
const myFunc = wavematch({
    false: (...args) => ...
    true: (...args) => ...
})
```

<h4 align='center'>Match Functions</h4>

<p align='center'>todo</p>

<h4 align='center'>Argument type-checking</h4>

Provide type checking based on a `types` key.
The constructor at each index is asserted against the `toString` value of each argument.

```javascript
const filter = wavematch({
    types: [Function, Array]
    , default: (fn, array) => ...
})
```

<h2 align='center'>To Do</h2>

- Add examples to README (wip).
- Add tests for Number, regexp, empty array, float/double.
- Add tests for return a fixed value instead of a function.
- Add support for parameter type checking.
- Add support for an `Any` type, in `pattern.types` (is this a good idea?).
- Add support for recursive functions like `zipWith`.
- Add support for function matching.
- Add support for empty string matching, either way.
- In index.js, provide better error messages by supplying `fn.name` to the `Error` call.

<h5 align='center'>Takeaway</h5>
- Object property ordering is not guaranteed.
