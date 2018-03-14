# Syntax
[syntax]: #syntax

Something from the Rust matching thingy here.

```javascript

wavematch(VALUE)(
  ARGUMENT => EXPRESSION,
  |      |
  --------
       | |
  type args = [ Any ]

  (ARGUMENT = PATTERN) => EXPRESSION
  |                  |
  --------------------
       |           |
  type reflectedArg = {
    argName: String
    default?: Any?
  }

  (ARGUMENT = PATTERN) => EXPRESSION
  |                                |
  ----------------------------------
       |        | 
  type rule = {
      expression: Function
      arity: Number
      allReflectedArgs:  [ reflectedArg ]
  }
)
```

# To Do

- Error if two identical functions are provided ("Unreachable pattern: duplicate" (see Rust error message for this error))
```javascript
(s = '') => ...
(s = '') => ...
// and
_ => ...
_ => ...
```
- if any rule has any arg that has a function as its default value, `reflect` that function (why?)
- write tests

# Reading

- doc.rust-lang.org/book/second-edition/ch18-01-all-the-places-for-patterns.html
- github.com/chrisisler/wavematch
- github.com/rust-lang/rfcs/blob/master/text/1522-conservative-impl-trait.md
- https://stackoverflow.com/questions/46596235/flow-generic-type-for-function-expression-arrow-functions
- https://ponyfoo.com/articles/pattern-matching-in-ecmascript
