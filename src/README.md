## Syntax
[syntax]: #syntax

Something from the Rust matching thingy here.

```javascript
wavematch(VALUE, VALUE2, ..., VALUE_N)(
  (ARGUMENT = PATTERN, ARGUMENT2 = PATTERN2) => EXPRESSION
  |                  |
  --------------------
       ||||||||||||
  type ReflectedArg = {
    argName: String
    default?: Any
    isDestructured: Boolean,
    body: String
  }

  (ARGUMENT = PATTERN, A2 = P2, ..., A = P) => EXPRESSION
  |                                                     |
  -------------------------------------------------------
       |||| 
  type rule = {
    expression: RuleExpression = (...Array<mixed>) => ?mixed
    arity: Number
    allReflectedArgs: Array<ReflectedArg>
  }
)
```

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

## Reading

- doc.rust-lang.org/book/second-edition/ch18-01-all-the-places-for-patterns.html
- github.com/chrisisler/wavematch
- github.com/rust-lang/rfcs/blob/master/text/1522-conservative-impl-trait.md
- https://stackoverflow.com/questions/46596235/flow-generic-type-for-function-expression-arrow-functions
- https://ponyfoo.com/articles/pattern-matching-in-ecmascript

## Notes

- NPM packages that don't work for parsing args:
  - get-function-arguments
  - function-arguments
  - js-function-reflector
  - fn-args
  - handle-arguments
  - manage-arguments
