JS Pattern Matching

# WAVEMATCH

<p align='center'>
Compare inputs against descriptions to check for compatibility.
If a pattern is compatible, the corresponding expression is executed.
Return a value or apply a function to the arguments.
Fallback to an optional `default` if no match succeeds.
</p>

```JavaScript
factorial example here
```

## String
- Empty string
- Nonempty string

## Number
- Floats

## Null/Undefined

## RegExp

## Array
- Non-greedy:
  - empty array
  - array of length 1
  - array of length N
- Greedy:
  - Match an array of arbitrary length
  - Match an array of at least length 1
  - Match an array of at least length N

## Object
- Non-greedy:
  - empty object (no keys)
  - exactly N named keys
  - exactly N unnamed keys (specific number of keys of any name)
  - Match an object with exactly N named keys and M unnamed keys
> TODO: Provide friendly error messages for case-sensitivity of keys (upon mismatch)
- Greedy:
  - zero or more keys
  - N or more named keys
  - N or more unnamed keys
  - N or more named keys and M or more unnamed keys

## Booleans

## Functions

## To Do

- Add support for recursive functions like `zipWith`.
- Add support for function matching.

## Limitations

- Cannot match an empty string.
- `js-function-reflector` package is limited in that it cannot properly be
  applied to a function with an argument with a default value that is a
  function whose arguments section/block begins with a parenthesis.
  Example: reflect(
    (arg = () => 3) => {

    },
    // this also does NOT work:
    (arg = function () {}) => {
                  // ^ error: "Unexpected end of input"
    }
  )
  This means that wavematch cannot match input values that are anonymous functions

- (`js-function-reflector` package) cannot replace variable name (some `K`) with value
  of a rule with a argument with a default K. (It becomes `undefined` instead of the value.)
  Essentially, we cannot capture outer values (things outside the scope).
  Example:
  const foo = 5
  reflect(
    (arg = foo) => {
        // ^ `{ default: undefined }`
    }
  )
  Possible Workaround:
    If some RuleArg has a `undefined` value for the `default` property, do a
    `.toString()` call on the function that is the default for the argument
    (for the given RuleArg) and if the identifier after the `=` sign is 
    something/idk then throw an Error with a friendly helpful message.
    Example:
      const baz = 5
      const f = wavematch(VALUE)(
        (arg = baz) => {
            // ^ throw Error(`Wavematch rule (number ${N}) (named ${name}) contains out of scope default value for argument ${argName}`)
        }
   )
