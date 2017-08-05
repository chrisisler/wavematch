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
/** @example '_, { x, y }, foo, [ bar, baz ]' -> ['_', '{ x, y }', 'foo', '[ bar, baz ]'] */
// String -> Array[String]
const getMatchers = token => {
    const objMatch = token.includes('{') && OBJ_REGEXP.exec(token)
    const arrayMatch = token.includes('[') && ARRAY_REGEXP.exec(token)
    let mutableToken = String(token) // Clone the input
    let matchers = []

    // Remove sections of the string which describe Objects
    if (objMatch) {
        // Remove the substring containing the regexp match
        mutableToken = mutableToken.replace(OBJ_REGEXP, '')
        matchers.push(...objMatch[0].replace(/\s*/g, '').split(/,(?=\{)/g))
    }

    // Remove sections of the string which describe Arrays
    if (arrayMatch) {
        // Remove the substring containing the regexp match
        mutableToken = mutableToken.replace(ARRAY_REGEXP, '')
        matchers.push(...arrayMatch[0].replace(/\s*/g, '').split(/,(?=\[)/g))
    }

    //todo: do we need this `if` statement?
    // if (mutableToken.includes(',')) {
    // Retrieve matchers from the `token` String which do not describe Objects or Arrays
    const otherMatchers = mutableToken.split(',').map(str => str.trim()).filter(Boolean)
    matchers.push(...otherMatchers)
    // }
    return matchers
}

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
