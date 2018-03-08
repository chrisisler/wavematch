# Summary
[summary]: #summary

```javascript
const factorial = N => wavematch(N)(
  (N = 0) => 1,
  _       => N * factorial(N - 1)
)
factorial(5) //=> 120

// zip example
// zipWith example
// fibonnaci example
// flatten example
// non-function example
// flow types example
// typescript example
// react example
```

What does this do?

How would it be used?


# Background
[background]: #background

What is pattern matching?
Point out previous discussions with (bullet-point) links.
How is this different than before?
What do you need to get started? Previous knowledge?


# Motivation
[motivation]: #motivation

Why are we doing this?
What use cases does it support?
What is the expected outcome?
(What problem does this (new thing/solution) solve?)

# Syntax
[syntax]: #syntax

Something from the Rust matching thingy here.

```javascript
wavematch(VALUE)(
  ARGUMENT => EXPRESSION,
  (ARGUMENT = PATTERN) => EXPRESSION
)


wavematch(VALUE_1, VALUE_2, ..., VALUE_N)(
  (ARG_1 = PATTERN_1, ARG_2 = PATTERN_2, ..., ARG_N = PATTERN_N) => EXPRESSION
)
```
