//todo: deformat all pattern keys, sort them by `sortFn`, then reformat them.

/** (String|Number, String|Number) -> Boolean */
const sortFn = (a, b) => a < b

/** String -> String */
/** @example '{ y, x }' -> 'x,y' */
const formatToken = token => token.replace(/[{}\s*]/g, '').split(',').sort(sortFn).join(',')

/** Object -> String */
/** @example { y: 3, x: 'baz' } -> 'x,y' */
const formatArg = arg => JSON.stringify(Object.keys(arg).sort(sortFn)).replace(/[\[\]"\s*]/g, '')

/** Object -> Function(Any) -> Any */
const match = pattern => arg => {
    // Number, String, and Boolean match.
    if (pattern[arg]) return pattern[arg](arg)

    // Object match.
    const objMatch = Object.keys(pattern).find(token => formatToken(token) === formatArg(arg))
    if (objMatch) return pattern[objMatch](arg)

    // Array match.
    //todo

    // Null/undefined match.
    //todo. use underscore

    // Default match.
    // return pattern.else(arg)
}

const foo = match({
    '{ x, y }': () => 'xy'
    , '{ x, y, z }': () => 'xyz'
    , else: () => 'default'
})

const result = foo({ y: 3, x: 2, z: 2})
console.log('result is:', result);
