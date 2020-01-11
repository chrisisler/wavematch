## Introduction

Wavematch is a control flow mechanism for JavaScript.

### Dev

- Collection
    - Array/N-Tuple
        - Support `([]) => {}` as shortcut for `(array = []) => {}`
    - Records
        - What should `({ bar }) => {}` pattern-less object deconstruction match on?
            - Equivalent to `Object`? Because `bar` prop may be `bar?: any`
            - Also need to consider this edge case: `({ length } = Array) => {}`
- `BigInt`
- Guard
    - Requires `eval`
    - Could do: `(x = $ => Number($ > 3)) => {}` or `(n = $ => Array($ >= 3))`
        - Would avoid `eval`
- CustomType N-level subclassing
    - Repeatedly call `Object.getPrototypeOf(arg)`
