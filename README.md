## Introduction

Wavematch is a control flow mechanism for JavaScript.

### Dev

- `RegExp` pattern for strings
- Union `|`
- `BigInt` ?
- Collection
    - Records
        - What should `({ bar }) => {}` pattern-less object deconstruction match on?
            - Equivalent to `Object`? Because `bar` prop may be `bar?: any`
            - Also need to consider this edge case: `({ length } = Array) => {}`
    - Array/N-Tuple
        - Support `([]) => {}` as shortcut for `(array = []) => {}`
- Guard
    - Requires `eval`

### Thoughts

- Allow `Foo => {}` as shortcut for `(named = Foo) => {}`
    - Only applies to Typed (!) and CustomTyped patterns
    - Will overwrite that identifier for the entire scope of that block!
        - Could use `$Foo => {}` as alternative, but introduces "weird" syntax
- CallExpressions ?
    - `(err = Error(242)) => {}` for error codes
    - `(array = Array(3)) => {}` for exact array sizes / tuple lengths w/o specifying type at each position
    - `(str = String(3)) => {}` for exact string lengths
    - Provide warning for `(array = Array(0)) => {}`
- Guards v2
    - Would avoid `eval`
    - Could do: `(x = $ => Number($ > 3)) => {}` or `(x = $ => String($ > 3)) => {}` or `(n = $ => Array($ >= 3))`
        - That is a type AND a value requirement
        - Could extract from AST without `eval`