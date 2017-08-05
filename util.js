// Do not change these!
const OBJ_REGEXP = /{.*}/
const ARRAY_REGEXP = /\[.*\]/

// (Array[Any], Function(Any, Number, Array[Any]) -> Boolean) -> Boolean
const isIn = (xs, f) => -1 !== xs.findIndex(f)

// (Function, Any) -> Boolean
const isType = (type, val) => Object.prototype.toString.call(val) === `[object ${type}]`

// String -> Boolean
const isBooleanStr = str => (str === 'false') || (str === 'true')

// (String|Number, String|Number) -> Boolean
const sortFn = (a, b) => a < b

/** @example '{ y, x, }' -> 'x,y' */
// String -> String
const formatMatcherObjString = matcher => matcher
    .replace(/[{}\s*]/g, '')
    .split(',')
    .filter(Boolean) // Removes empty strings caused by trailing commas
    .sort(sortFn)
    .join(',')

/** @example { y: 3, x: 'baz' } -> 'x,y' */
// Object -> String
const formatArgumentObj = arg => JSON.stringify(Object.keys(arg).sort(sortFn)).replace(/[\[\]"\s*]/g, '')

// (String, Object) -> Boolean
const hasIdenticalKeys = (matcher, arg) => formatMatcherObjString(matcher) === formatArgumentObj(arg)

/** @todo cache the return value of the function for recursive calls */
/** @throws {Error} Note: Keep the returned `matchers` in order with `token`, avoid re-using identifiers/names. */
/** @example '_, { x, y, }, foo, [ bar, foo, ]' -> ['_', '{ x, y, }', 'foo', '[ bar, foo, ]'] */
// String -> Array[String]
const getMatchers = token => {
    const tkn = token.replace(/\s*/g, '')
    let mutableToken = tkn
    // console.log('tkn is:', tkn)

    const matchers = [ OBJ_REGEXP, ARRAY_REGEXP ].reduce((acc, regexp) => {
        const matchInfo = regexp.exec(tkn)
        if (matchInfo) {
            const matcher = matchInfo[0]
            const copy = tkn.replace(matcher, '')
            mutableToken = mutableToken.replace(matcher, '')
            // if (acc.length && acc.includes(matcher)) throw new Error('Duplicate parameter/matcher name not allowed.')
            const rest = copy.split(',').filter(Boolean)
            acc.push(matcher, ...rest)
        }
        return acc
    }, [])
        .concat(...mutableToken.split(','))
        .sort(([ char1 ], [ char2 ]) => tkn.indexOf(char1) > tkn.indexOf(char2))
    console.log('tkn is:', tkn)
    console.log('matchers is:', matchers)

    // const uniqMatchers = new Set(matchers.map(m => m.split(',').filter(Boolean).join('')))
    // if (matchers.length !== uniqMatchers.length) throw new Error('Duplicate parameter/matcher name not allowed.')
    // console.log('matchers is:', matchers)

    return matchers
}
getMatchers('false')

/**
 * Performs type checking for each equally-indexed (Function, value) pair.
 *
 * @todo Add support for `Any`
 * @throws {Error|TypeError}
 * @param {Array[Function]} types
 * @param {Array[Any]} args
 */
const checkTypes = (types, args) => {
    if (!isType('Array', types))
        throw new TypeError('`types` must be an Array.')
    else if (types.length !== args.length)
        throw new Error('Number of types does not match number of arguments.')

    // If any `arg[i]` is not the type given by `types[i]` then throw an error
    const errIdx = args.findIndex((arg, i) => !isType(types[i].name, arg))
    if (errIdx !== -1)
        throw new TypeError(`Type mismatch: Argument at index ${errIdx} should be of type ${types[errIdx].name}.`)
}

module.exports = {
    OBJ_REGEXP
    , ARRAY_REGEXP
    , getMatchers
    , hasIdenticalKeys
    , isBooleanStr
    , checkTypes
    , isIn
}
