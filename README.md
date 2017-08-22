# Rematch - Pattern Matching

Powerful JavaScript pattern matching.

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

#### String
```javascript
// Match an empty string, either way works.
const myFunc = rematch({
    '""': (...args) => doStuff(args)
    "''": (...args) => doStuff(args)
})

// Match a literal string.
const myFunc = rematch({
    'andy': (...args) => doStuff(args)
})
```

#### Number
```javascript
// Match numbers literally.
const myFunc = rematch({
    0: 'zero',
    5: 'five'
})
```


#### Null and Undefined
```javascript
cosnt myFunc = rematch({
    null: (...args) => doStuff(args),
    undefined: (...args) => doStuff(args)
})
```

#### Regular Expression
#### Array
#### Object
#### Function
#### Boolean
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
