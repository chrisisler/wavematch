// Do not change these! Hoisted regexp's are more performant than on-the-fly/in-place
const OBJ_REGEXP = /{.*}/
const ARRAY_REGEXP = /\[.*\]/
const STRIP_WHITESPACE_REGEXP = /\s*/g
const MATCHER_OBJ_STR_REGEXP = /[{}\s*]/g
const ARGUMENT_OBJ_REGEXP = /[\[\]"\s*]/g

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
    .replace(MATCHER_OBJ_STR_REGEXP, '')
    .split(',')
    .filter(Boolean) // Removes empty strings caused by trailing commas
    .sort(sortFn)
    .join(',')

/** @example { y: 3, x: 'baz' } -> 'x,y' */
// Object -> String
const formatArgumentObj = arg => JSON.stringify(Object.keys(arg).sort(sortFn)).replace(ARGUMENT_OBJ_REGEXP, '')

// (String, Object) -> Boolean
const hasIdenticalKeys = (matcher, arg) => formatMatcherObjString(matcher) === formatArgumentObj(arg)

/** @todo cache the return value of the function for recursive calls */
/** @todo, @throws {Error} Note: Keep the returned `matchers` in order with `token`, avoid re-using identifiers/names */
/** @example '_, { x, y, }, foo, [ bar, foo, ]' -> ['_', '{ x, y, }', 'foo', '[ bar, foo, ]'] */
// String -> Array[String]
const getMatchers = token => {
    const tkn = token.replace(STRIP_WHITESPACE_REGEXP, '')
    let mutableTkn = tkn
    const matchers = [ OBJ_REGEXP, ARRAY_REGEXP ].reduce((acc, regexp) => {
            const matchInfo = regexp.exec(tkn)
            if (matchInfo) {
                const matcher = matchInfo[0]
                mutableTkn = mutableTkn.replace(matcher, '') // Keeps a "history" of remaining matchers.
                acc.push(matcher, ...tkn.replace(matcher, '').split(',').filter(Boolean))
            }
            return acc
        }, [])
        .concat(...mutableTkn.split(',').filter(Boolean))
        .sort(([ char1 ], [ char2 ]) => tkn.indexOf(char1) > tkn.indexOf(char2)) // Retain the given order 

    return matchers
}
// getMatchers('[foo,] foo,')

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
        throw new TypeError(`\`types\` must be an Array, instead is: ${typeof types}`)
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
