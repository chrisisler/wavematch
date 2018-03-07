# Summary
[summary]: #summary

What does this do?

How would it be used?
```javascript
const factorial = n => wavematch(n)(
  (n = 0) => 1,
  _ => n * factorial(n - 1)
)
factorial(5) //=> 120
```


# Background
[background]: #background

Point out previous discussions with (bullet-point) links.
How is this different than before?
What do you need to get started? Previous knowledge?


# Motivation
[motivation]: #motivation

Why are we doing this?
What use cases does it support?
What is the expected outcome?
(What problem does this (new thing/solution) solve?)

# Design
[design]: #design

## Syntax

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

# To Do

- Error if two identical function prototypes provided ("Unreachable pattern: duplicate" (see Rust error message for this error))
```
(s = '') => ...
(s = '') => ...
and
_ => ...
_ => ...
```
- TODO collect errors instead of throwing instantly
- TODO if any rule has any arg that has a function as its default value, `reflect` that function (why?)

# Reading

- doc.rust-lang.org/book/second-edition/ch18-01-all-the-places-for-patterns.html
- github.com/chrisisler/wavematch
- github.com/arrizalamin/js-function-reflector
- github.com/rust-lang/rfcs/blob/master/text/1522-conservative-impl-trait.md
