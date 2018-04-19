# Wavematch

Compare values against patterns and execute code based on which pattern matches.
Patterns can be made up of literal values, type checks, conditional guards, and wildcards.

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

## Examples

```javascript
let zip = (xs, ys) => wavematch(xs, ys)(
  (xs, ys = []) => [],
  (xs = [], ys) => [],
  ([x, ...xs], [y, ...ys]) => [x, y].concat(zip(xs, ys))
)
```

```javascript
let zipWith = (f, xs, ys) => wavematch(f, xs, ys)(
  (f, xs = [], ys) => [],
  (f, xs, ys = []) => [],
  (f, [x, ...xs], [y, ...ys]) => [f(x, y)].concat(zipWith(f, xs, ys))
)
```

## Limitations
[limitations]: #limitations

- All patterns which describe objects must be valid [JSON5](json5.org)

## To Do

- if doing object destructuring for a rule, check in `src/index.js` that the input values actually has that key at that object at that argument index.
- remove all the `// prettier-ignore` from test files
- support constructors as values for patterns that attempt to match/describe a type
- Support multiple options:
  ```javascript
  wavematch(number)(
    (num = 3 or 4) => foo,
  )
  ```
- if any rule has any arg that has a function as its default value, `reflect` that function (why?)
- decide on a version of Node to support (the one with rest/spread operator?)

```javascript
// nested example
// flow types example
// typescript example
```


## Reading

- doc.rust-lang.org/book/second-edition/ch18-01-all-the-places-for-patterns.html
- github.com/chrisisler/wavematch
- github.com/rust-lang/rfcs/blob/master/text/1522-conservative-impl-trait.md
- https://stackoverflow.com/questions/46596235/flow-generic-type-for-function-expression-arrow-functions
- https://ponyfoo.com/articles/pattern-matching-in-ecmascript
- https://github.com/zkat/proposal-pattern-matching/blob/master/README.md
- https://docs.scala-lang.org/tour/pattern-matching.html
- https://code.haxe.org/category/beginner/pattern-matching.html

## Notes

- NPM packages that don't work for parsing args:
  - get-function-arguments
  - function-arguments
  - js-function-reflector
  - fn-args
  - handle-arguments
  - manage-arguments
