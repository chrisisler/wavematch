# Summary
[summary]: #summary

```javascript
const factorial = N => wavematch(N)(
  (N = 0) => 1,
  _       => N * factorial(N - 1)
)
factorial(5) //=> 120

const isUsd = item => wavematch(item)(
    (arg = { options: { currency: 'USD' } }) => true,
    _ => false
    )
isUsd({ value: 19.99, options: { currency: 'USD' } }) //=> true
isUsd({ value: 19.99, options: { currency: 'ARS' } }) //=> false

// zip example
// zipWith example
// fibonnaci example
// flatten example
// non-function example
// nested example
// async/await example
// flow types example
// typescript example
// react example
```

> What does this do?
JavaScript's missing control flow operator.

Compare values against a series of patterns and execute code based on which pattern matches.
Patterns can be made up of literal values, type checks, and wildcards.

> How would it be used?


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

Assuming your editor supports code snippets, here's a snippet for wavematch:
```javascript
wavematch(${1:value})(
  (${2:arg} = ${3:pattern}) => ${4:expression}
  _ => ${5:defaultExpression}
)
```
