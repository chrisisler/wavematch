# wavematch

## Introduction

Wavematch is a control flow construct that allows you to execute code conditionally.

An example of `wavematch` usage:

```JavaScript
const x = 1;

wavematch(x)(
  (_ = 1) => console.log('one'),
  (_ = 2) => console.log('two'),
  (_ = 3) => console.log('three'),
  (_ = 4) => console.log('four'),
  (_ = 5) => console.log('five'),
  _ => console.log('something else')
);
```

Multiple patterns may be joined with the `|` operator. Each pattern will be
tested left-to-right until a successful match is found.

```JavaScript
const message = wavematch(9)(
  (_ = 0 | 1) => 'not many',
  (_ = Number(2, 9)) => 'a few',
  _ => 'lots'
);
```

Note: The `Number(2, 9)` is a number range pattern, 9 itself is excluded.

Each branch function provided must return the same type.























## Roadmap

- [wip] Guards testing
- [ ] Array destructuring with rest elements (matching array lengths)
- [ ] Object destructuring with rest elements (matching object keys)
- [ ] Object destructuring 
- [ ] NaN

## History

## Limitations
