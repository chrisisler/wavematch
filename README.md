# Rematch

Powerful JavaScript pattern matching.

Compare input data against patterns and descriptions to check for compatible matches.
If a match is compatible, the corresponding logic is executed.

```JavaScript
const factorial = rematch({
    0: 1,
    default: (n) => n * factorial(n - 1)
})
```

## Usage

#### String

Match an empty string, either way works.
```javascript
const myFunc = rematch({
    '""': (...args) => doStuff(args)
    "''": (...args) => doStuff(args)
})
```

#### Number

Match numbers literally.
```javascript
const myFunc = rematch({
    0: 'zero',
    5: 'five'
})
```

#### Regular Expression
#### Array
#### Object
#### Function
#### Boolean
#### Null
#### Undefined (void 0)


## To do

Add examples to README.
Write remaining tests for Number, regexp, empty obj/arrary, and error throwing.
Support recursive functions.
- `zipWith`
Support empty objects.
Support function matching.
Empty string matching, either way.
Add parameter type checking.
- Add support for an `Any` type, in `pattern.types` (is this a good idea?).
In index.js, provide better error messages by supplying `fn.name` to the `Error` call.
