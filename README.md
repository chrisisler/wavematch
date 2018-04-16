# Wavematch

> Control flow operator for matching values against patterns.

```sh
yarn add wavematch
```

```javascript
let number = wavematch(random(0, 5))(
  (n = 0) => 'zero',
  (n = 1) => 'one',
  (n = 2) => 'two',
  _       => 'otherwise'
)
```

The input value is a random number between 0 and 5.
`number` is assigned to the result of whichever rule matches the input.
Four rules are given, the last being a wildcard rule which acts as a fallback.

## Matching Types

Using standard type constructors as patterns facilitates type-based matching.

```javascript
let toDate = dateString => wavematch(dateString)(
  (date = Date) => date,
  (date = String) => new Date(date)
)
```

```javascript
let map = (fn, x) => wavematch(fn, x)(
  (fn, x = Array) => x.map(fn),
  (fn, x = Object) => Object.keys(x).map(key => fn(x[key]))
)
```

Now `map` behaves according to the type of the data being operated on!

## Match Guards

Guards are boolean expressions used to match certain conditions.

```javascript
let number = wavematch(random(0, 100))(
  (number = 99)          => 'ninety-nine',
  (number = $ => $ > 30) => 'more than thirty',
  _                      => 'everything else'
)
```

> Using `$` for guard conditions may aid readability.
