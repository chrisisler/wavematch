# Rematch

Powerful JavaScript pattern matching.

I've been reading a lot about F#, Haskell, and functional programming topics in general.
Pattern matching caught my eye, and since my primary language at the moment is JS, I
figured I would try to implement it. It's called Rematch.

A lot of the benefits of pattern matching include destructuring in your desired match.
ES6 allows for destructuring, so there goes me needing to support that.

Pattern matching consists of specifying patterns to which some data should conform to,
checking to see if it does, then acting on that input based on some corresponding logic.

## To do

#### Need

Add examples to README.

Write remaining tests for Number and error throwing.

Support recursive functions.
- `zipWith`

Support empty objects.
Support N-keyed objects.

Support function matching.

#### Want

Add support for error catching with a `catch` key.

Add parameter type checking.
- Add tests for type checking.
- Add support for an `Any` type, in `pattern.types` (is this a good idea?).

In index.js, provide better error messages by supplying `fn.name` to the `Error` call.

Is there a way to optimize recursive calls in index.js?
