// Hoisted regexps are more performant than using them in-place
const OBJ_MATCH_REGEXP = /{.*}/
const ARR_MATCH_REGEXP = /\[.*\]/
const REGEXP_MATCH_REGEXP = /\/.*\//
const STRIP_WHITESPACE_REGEXP = /\s*/g
const MATCHER_OBJ_STR_REGEXP = /[{}\s*]/g
const ARGUMENT_OBJ_REGEXP = /[\[\]"\s*]/g

/** @type {Function -> Function} */
const curry2 = f => (x, y) => !y ? y2 => f(x, y2) : f(x, y)

/** @type {Function -> Any -> Boolean} */
const isType = curry2((type, val) => Object.prototype.toString.call(val) === `[object ${type}]`)

/** @type {String -> Boolean} */
const isBooleanAsString = str => (str === 'false') || (str === 'true')

/** @type {(String|Number, String|Number) -> Boolean} */
const sortFn = (a, b) => a < b

/** @example '{ y, x, }' -> 'x,y' */
/** @type {String -> String} */
const formatMatcherObjString = objMatcher => objMatcher
    .replace(MATCHER_OBJ_STR_REGEXP, '')
    .split(',')
    .filter(Boolean) // Removes empty strings caused by trailing commas
    .sort(sortFn)
    .join(',')

/** @example { y: 3, x: 'baz' } -> 'x,y' */
/** @type {Object -> String} */
const formatArgumentObj = arg =>
    JSON.stringify(Object.keys(arg).sort(sortFn))
        .replace(ARGUMENT_OBJ_REGEXP, '')

/** @type {(String, Object) -> Boolean} */
const hasIdenticalKeys = (objMatcher, arg) =>
    formatMatcherObjString(objMatcher) === formatArgumentObj(arg)

/**
 * @todo, @throws {Error} Note: Keep the returned `matchers` "in order" with `token`, avoid re-using identifiers/names
 * @example '_, { x, y, }, abc, [ bar, foo, ]' -> ['_', '{ x, y, }', 'abc', '[ bar, foo, ]']
 * @type {String -> [String]}
 */
const getMatchers = token => {
    const tkn = token.replace(STRIP_WHITESPACE_REGEXP, '')
    let mutableTkn = String(tkn)
    return [ OBJ_MATCH_REGEXP, ARR_MATCH_REGEXP, REGEXP_MATCH_REGEXP ]
        .reduce((matchers, regExp) => {
            const matchInfo = regExp.exec(tkn)
            if (matchInfo) {
                const [ matcher ] = matchInfo
                mutableTkn = mutableTkn.replace(matcher, '') // Keeps a "history" of remaining matchers.
                matchers = matchers.concat(matcher)
            }
            return matchers
        }, [])
        .concat(...mutableTkn.split(',').filter(Boolean)) // Add non-array/object matchers, remove trailing commas
}

// Maybe `.sort` both arrays?
/** @type {([String], [String]) -> Boolean} */
const isEqualStringArrays = (xs, ys) => JSON.stringify(xs) === JSON.stringify(ys)

module.exports = {
    REGEXP_MATCH_REGEXP
    , ARR_MATCH_REGEXP
    , OBJ_MATCH_REGEXP
    , isEqualStringArrays
    , isBooleanAsString
    , hasIdenticalKeys
    , getMatchers
    , isType
    , sortFn
}
