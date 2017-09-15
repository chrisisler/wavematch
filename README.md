<h1 align='center'>Wavematch</h1>
<h3 align='center'><strong>JS pattern matching</strong></h3>
<h5 align='center'><strong>Conditionals, enhanced switch-case, and more.</strong></h5>

<p align='center'>
Compare inputs against descriptions to check for compatibility.
If a pattern is compatible, the corresponding expression is executed.
Return a value or apply a function to the arguments.
Fallback to an optional `default` if no match succeeds.
</p>

```JavaScript
const factorial = wavematch({
    0: 1,
    default: (n) => n * factorial(n - 1)
})
```


<h2 align='center'>Install</h2>
```bash
npm i wavematch

# or with yarn
yarn add wavematch
```


<h2 align='center'>Usage</h2>


<h3 align='center'>Match Strings</h3>
<p>Match string literals, case-sensitive. Any quote style works.</p>

```javascript
const stringMatch = wavematch({
    "foo": (...args) => ...
    'andy': (...args) => ...
    bar: (...args) => ...
})
```
<br>


<h3 align='center'>Match Numbers</h3>

```javascript
const numberMatch = wavematch({
    0: (...args) => ...
    5: (...args) => ...

    3.2: (...args) => ...
})
```
<br>


<h3 align='center'>Match Null and Undefined</h3>

```javascript
const nullMatch = wavematch({
    null: (...args) => ...
    undefined: (...args) => ...
})
```
<br>


<h3 align='center'>Match Regular Expressions</h3>

```javascript
const regExpMatch = wavematch({
    '/foo/': (...args) => ...
    default: (...args) => ...
})
```
<br>


<h3 align='center'>Match Arrays</h3>

```javascript
const arrayMatch = wavematch({
    // Match an empty array
    '[]': (...args) => ...

    // Match an array of length 1
    '[ blah ]': (...args) => ...

    // Match an array of length N
    '[ blah, foo ]': (...args) => ...

    // Match an array of arbitrary length
    '[...]': (...args) => ...

    // Match an array of at least length 1
    '[ x, ... ]': (...args) => ...

    // Match an array of at least length N
    '[ x, y, ... ]': (...args) => ...
})
```


<h3 align='center'>Match Objects</h3>
Use the exact (case-sensitive) word to match a key of that exact name.
Use an underscore character to match a key of any name.
Trailing commas are supported and will not cause errors, (if you find a bug,
please [file an issue](https://github.com/chrisisler/wavematch/issues/new)).

```javascript
const nonGreedyLogic = wavematch({
    // Match only an empty object (no keys)
    '{}': (...args) => ...

    // Match an object with exactly N named keys
    '{ x }': (...args) => ...
    '{ x, y }': (...args) => ...

    // Match an object with exactly N unnamed keys
    // For when you want a specific amount of keys of any name
    '{ _ }': (...args) => ...
    '{ _, _ }': (...args) => ...

    // Match an object with exactly N named keys and M unnamed keys
    '{ x, _ }': (...args) => ...
    '{ x, y, _, _ }': (...args) => ...
    '{ x, y, _, foo }': (...args) => ...
})

const greedyLogic = wavematch({
    // Matches any object (zero or more keys)
    '{...}': (...args) => ...

    // Match an object with N or more named keys
    '{ x, ... }': (...args) => ...
    '{ x, y, ... }': (...args) => ...

    // Match an object with N or more unnamed keys
    '{ _, ... }': (...args) => ...
    '{ _, _, ... }': (...args) => ...

    // Match an object with N or more named keys and N or more unnamed keys
    '{ x, _, ... }': (...args) => ...
    '{ x, _, z, ... }': (...args) => ...
})
```
<br>


<h3 align='center'>Match Booleans</h3>

```javascript
const logic = wavematch({
    false: (...args) => ...
    true: (...args) => ...
})
```
<br>


<h3 align='center'>Match Functions</h3>
<p align='center'>todo</p>
<br>


<h2 align='center'>To Do</h2>

- Add webpack to build step to allow `import` and `export` keywords.
- Add `curry2()` to the default export
- Add tests for RegExp
- Add tests for return a fixed value instead of a function.
- Add tests for `applyTransform`
- Add support for recursive functions like `zipWith`.
- Add support for function matching.

<h3 align='center'>Limitations</h3>
- Cannot match an empty string.
