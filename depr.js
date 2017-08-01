// (Constructor, Any) -> Boolean
const isType = (typeCtor, x) => Object.prototype.toString.call(x) === `[object ${typeCtor.toLowerCase()}]`

// (String|Number, String|Number) -> Boolean
const sortFn = (a, b) => a < b

// String -> String
/** @example '{ y, x }' -> 'x,y' */
const formatToken = token => token.replace(/[{}\s*]/g, '').split(',').sort(sortFn).join(',')

// Object -> String
/** @example { y: 3, x: 'baz' } -> 'x,y' */
const formatArg = arg => JSON.stringify(Object.keys(arg).sort(sortFn)).replace(/[\[\]"\s*]/g, '')



// Object -> Function(Any) -> Any
// const explicit = pattern => arg => {
//     // Number, String, and Boolean match
//     if (pattern[arg]) return pattern[arg](arg)

//     // Object match
//     const objMatch = isType('Object', arg) && Object.keys(pattern).find(token => formatToken(token) === formatArg(arg))
//     if (objMatch) return pattern[objMatch](arg)

//     // Array match
//     if (arg === '[]') return pattern[arg](arg)

//     // Null/undefined match
//     if (arg == null && pattern['_']) return pattern['_']()

//     // Default match
//     return pattern.default(arg)
// }

// N-ary arguments
// const nAryMatch = pattern => (...args) => {
//     const nAryMatchToken = Object.keys(pattern)
//         .filter(key => false === /[\[\]]/g.test(key)) // Remove array tokens
//         .filter(key => false === /[\{\}]/g.test(key)) // Remove object tokens
//     if (nAryMatchToken) return pattern[nAryMatchToken](...args)
//     return pattern.default(...args)
// }

// const zipWith = match({
//     '_, [], _': () => [],
//     '_, _, []': () => [],
//     default: (fn, [x, ...xs], [y, ...ys]) => [fn(x, y)].concat(zipWith(fn, xs, ys))
// })

// console.log(
//     zipWith((x, y) => [x, y], [ 1, 2, 3 ], 'xyz'.split(''))
// )

// module.exports = rematch

// const add = match({
//     'x, _, _': () => 'x visible'
//     , '_, y, _': () => 'y visible'
//     , '_, _, z': () => 'z visible'
//     , 'x, y, z': (x, y, z) => x + y + z
// })

// // console.log(
// //     add(false, undefined, null)
// // )
