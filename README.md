# Rematch - Pattern Matching

*Powerful JavaScript pattern matching.*

Compare input data against patterns and descriptions to check for compatible matches.
If a match is compatible, the corresponding logic is executed. Return a fixed value
or apply a function to the input.

```JavaScript
const factorial = rematch({
    0: 1,
    default: (n) => n * factorial(n - 1)
})
```

## Usage

#### Match Strings
```javascript
// Match an empty string, either way works.
const myFunc = rematch({
    '""': (input) => //...
    "''": (input) => //...
})

// Match a literal string.
const myFunc = rematch({
    'andy': (input) => //...
})
```

#### Match Numbers
```javascript
// Match exact numbers.
const myFunc = rematch({
    0: 'zero',
    5: 'five'
})
```


#### Match Null and Undefined
```javascript
const myFunc = rematch({
    null: (input) => //...
    undefined: (input) => //...
})
```

#### Match Regular Expressions
```javascript
const myFunc = rematch({
    '/foo/': () => 'haha',
    default: () => 'fallback'
})
myFunc('fo') //=> 'haha'
```

#### Match Arrays
```javascript
const myFunc = rematch({
    // Match an empty array
    '[]': () => 'empty!',

    // Match an array of length 1
    '[ blah ]': () => 'one!',

    // Match an array of length 2
    '[ blah, foo ]': () => 'two!'

    // Match an array of arbitrary length
    '[...]': () => 'yay!'

    //TODO
    // Match an array of at least length 1
    '[ x, ... ]': () => 'at least one'

    //TODO
    // Match an array of at least length 2
    '[ x, y, ... ]': () => 'at least two'
})
```
#### Match Objects
```javascript
const myFunc = rematch({
    //TODO
    // Match an empty object
    '{}': () => 'empty!',

    // Match an object with *only* the key `blah`
    '{ blah }': () => 'one key!',

    // Match an object with keys `age` and `name`
    '{ age, name }': () => 'two keys!'

    // Match an any non-empty object
    '{...}': () => 'yay!'

    //TODO
    // Match an object with key `x` and optionally more
    '{ x, ... }': () => 'at least x'

    //TODO
    // Match an object with keys `x`, `y`, and optionally more
    '{ x, y, ... }': () => 'at least x and y'
})
```

#### Match Functions
todo

#### Match Booleans
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
