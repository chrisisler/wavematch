## Introduction

Wavematch is a control flow mechanism for JavaScript.

### Remaining

- Negation `!`
- `RegExp` pattern for strings
- `Symbol`
- `BigInt` ?
- Guard
    - Requires `eval`
- Union `|`
- Collection
    - Records
        - What should `({ bar }) => {}` pattern-less object deconstruction match on?
            - Equivalent to `Object`? Because `bar` prop may be `bar?: any`
            - Also need to consider this edge case: `({ length } = Array) => {}`
    - Array/N-Tuple
- Custom Types
    - Subclasses
