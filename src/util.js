// Hoisted regexps are more performant than using them in-place
const OBJ_MATCH_REGEXP = /{.*}/
const ARRAY_MATCH_REGEXP = /\[.*\]/
const REGEXP_MATCH_REGEXP = /\/.*\//
const STRIP_WHITESPACE_REGEXP = /\s*/g
const MATCHER_OBJ_STR_REGEXP = /[{}\s*]/g
const ARGUMENT_OBJ_REGEXP = /[\[\]"\s*]/g

// (Function, Any) -> Boolean
const isType = (type, val) => Object.prototype.toString.call(val) === `[object ${type}]`

// String -> Boolean
const isBooleanAsString = str => (str === 'false') || (str === 'true')

// (String|Number, String|Number) -> Boolean
const sortFn = (a, b) => a < b

/** @example '{ y, x, }' -> 'x,y' */
// String -> String
const formatMatcherObjString = objMatcher => objMatcher
    .replace(MATCHER_OBJ_STR_REGEXP, '')
    .split(',')
    .filter(Boolean) // Removes empty strings caused by trailing commas
    .sort(sortFn)
    .join(',')

/** @example { y: 3, x: 'baz' } -> 'x,y' */
// Object -> String
const formatArgumentObj = arg => JSON.stringify(Object.keys(arg).sort(sortFn)).replace(ARGUMENT_OBJ_REGEXP, '')

// (String, Object) -> Boolean
const hasIdenticalKeys = (objMatcher, arg) =>
    formatMatcherObjString(objMatcher) === formatArgumentObj(arg)

/** @todo, @throws {Error} Note: Keep the returned `matchers` in order with `token`, avoid re-using identifiers/names */
/** @example '_, { x, y, }, abc, [ bar, foo, ]' -> ['_', '{ x, y, }', 'abc', '[ bar, foo, ]'] */
// String -> [String]
const getMatchers = token => {
    const tkn = token.replace(STRIP_WHITESPACE_REGEXP, '')
    let mutableTkn = String(tkn)
    return [ OBJ_MATCH_REGEXP, ARRAY_MATCH_REGEXP, REGEXP_MATCH_REGEXP ]
        .reduce((acc, regexp) => {
            const matchInfo = regexp.exec(tkn)
            if (matchInfo) {
                const [ matcher ] = matchInfo
                mutableTkn = mutableTkn.replace(matcher, '') // Keeps a "history" of remaining matchers.
                acc.push(matcher)
            }
            return acc
        }, [])
        .concat(...mutableTkn.split(',').filter(Boolean)) // Add non-array/object matchers, remove trailing commas
}

// TODO: Add support for `Any`
// ([Function], [Any]) -> ()
const checkTypes = (types, args) => {
    if (!isType('Array', types)) {
        throw new TypeError(`\`types\` must be an Array, instead is: ${typeof types}`)
    } else if (!types.every(t => isType('Function', t))) {
        throw new TypeError('Every type in `types` must be a Function.')
    } else if (types.length !== args.length) {
        throw new Error('Number of types does not match number of arguments.')
    }
    // Throw error if every `args[i]` is not the same type as `types[i]` for the same `i`
    const errIdx = args.findIndex((arg, idx) => !isType(types[idx].name, arg))
    if (errIdx !== -1) throw new TypeError(`Type mismatch: Argument at index ${errIdx} should be of type ${types[errIdx].name}.`)
}

// ([String], [String]) -> Boolean. Maybe `.sort` both arrays?
const isEqualStringArrays = (xs, ys) => JSON.stringify(xs) === JSON.stringify(ys)

module.exports = {
    REGEXP_MATCH_REGEXP
    , ARRAY_MATCH_REGEXP
    , OBJ_MATCH_REGEXP
    , isEqualStringArrays
    , isBooleanAsString
    , hasIdenticalKeys
    , getMatchers
    , checkTypes
    , isType
    , sortFn
}
