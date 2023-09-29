# wavematch

## Introduction

`wavematch` calls the first function whose patterns fit the arguments,
executing code conditionally.

An example of usage:

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

> Note: The `Number(2, 9)` is a number range, matching on numbers between 2 and 9.

Each function provided must return the same type (above it's `string`).

Branch functions can accept a boolean-returning *guard* to specify requirements.

```JavaScript
wavematch(1)(
  // Executes if `num` is greater than zero
  (num = $ => $ > 0) => {},
  _ => {},
)
```

Using multiple branch functions, we can take special actions for particular
values. For all other values, we take a default action (`_ => {}`) which is the
fallback branch.

Such control flow enables conditional assignment (`if let`).

```JavaScript
const todo = todos.find(item => item.id === id);
const text = wavematch(todo)(
  ({ name, isDone } = Todo) => isDone ? `${name} is done` : `${name} is not done`,
  _ => null,
);
```

The code in the branch function is not executed if the value does not match the
pattern.





















## Roadmap

- [wip] Guards testing
- [ ] Array destructuring with rest elements (matching array lengths)
- [ ] Object destructuring with rest elements (matching object keys)
- [ ] Object destructuring 
- [ ] NaN

## History

## Limitations
