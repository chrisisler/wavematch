const {
    OBJ_MATCH_REGEXP
    , ARRAY_MATCH_REGEXP
    , REGEXP_MATCH_REGEXP
    , hasIdenticalKeys
    , getMatchers
    , isBooleanAsString
    , checkTypes
    , isType
} = require('./util')

// String -> Number
const getArrayMatcherLength = arrayMatcher => arrayMatcher
    .replace(/[\[\]]/g, '')
    .split(',')
    .filter(Boolean)
    .length

// Any -> Boolean
const isNullOrUndef = x => isType('Undefined', x) || isType('Null', x)

// For non-zero, N-length, and arbitrary-length matches
// (String, Any) -> Boolean
const isSimilarLength = (arrayMatcher, arg) =>
    arrayMatcher.includes('...')
        ? arg.length > 0
        : arg.length === getArrayMatcherLength(arrayMatcher)

// String -> [String]
const getMatcherKeys = objMatcher => objMatcher
    .replace(/[}{\s]/g, '')
    .split(',')
    .filter(Boolean)

// ([String], [String]) -> Boolean. Maybe `.sort` both arrays?
const isEqualStringArrays = (xs, ys) => JSON.stringify(xs) === JSON.stringify(ys)

// ([Any], Any -> Boolean) -> [[Any], [Any]]
const partition = (xs, pred) =>
    xs.reduce((acc, x) => (acc[pred(x) ? 0 : 1].push(x), acc), [[], []])

/**
 * Checks cases (where `matcher` is known to satisfy the regexp /{.*}/ and `args` contains an Object):
 *     (1) '{...}'       (zero named keys && zero unnamed keys)
 *     (2) '{x, _, ...}' (one or more named keys && one or more unnamed keys)
 *     (3) '{x, ...}'    (one or more named keys && zero unnamed keys)
 *     (4) '{_, ...}'    (one or more unnamed keys && zero named keys)
 *     (A) '{}'       (zero named keys && zero unnamed keys)
 *     (B) '{x, _}' (one or more named keys && one or more unnamed keys)
 *     (C) '{x}'    (one or more named keys && zero unnamed keys)
 *     (D) '{_}'    (one or more unnamed keys && zero named keys)
 */
// (String, [Object]) -> Boolean
const checkAllObjectCases = (matcher, args) => {
    const validMatcherKeys = getMatcherKeys(matcher).filter(k => k !== '...')
    const [ unnamedMatcherKeys, namedMatcherKeys ] = partition(validMatcherKeys, s => s === '_')
    // console.log('unnamedMatcherKeys is:', unnamedMatcherKeys)
    // console.log('namedMatcherKeys is:', namedMatcherKeys)

    if (!validMatcherKeys.length && args.some(a => Object.keys(a).length === 0)) return true
    else if (unnamedMatcherKeys.length && namedMatcherKeys.length) {
        const someObjHasAllDesiredNamedKeys = namedMatcherKeys.every(nKey => args.some(a => Object.keys(a).includes(nKey)))
        const someObjHasAllDesiredUnnamedKeys =
            args.some(a => unnamedMatcherKeys.length <= Object.keys(a).filter(k => !namedMatcherKeys.includes(k)).length)
        return someObjHasAllDesiredNamedKeys && someObjHasAllDesiredUnnamedKeys
    }
    else if (namedMatcherKeys.length) {
        // console.log('namedMatcherKeys is:', namedMatcherKeys)
        // console.log('Object.keys(args[0]) is:', Object.keys(args[0]))
        args.some(a => {
            const [ unnamedArgKeys, namedArgKeys ] = partition(Object.keys(a), k => !namedMatcherKeys.includes(k))
            // return namedMatcherKeys.every(namedKey => ) //todo
        })
        return namedMatcherKeys.every(nKey => args.some(a => Object.keys(a).includes(nKey)))
    }
    else if (unnamedMatcherKeys.length) {
        return args.some(a => unnamedMatcherKeys.length <= Object.keys(a).filter(k => !namedMatcherKeys.includes(k)).length)
    }
    else {
        // console.log('else case')
    }
}

// (String, [Any]) -> Boolean
const canMatchAnyArgs = (matcher, args) => {
    if (matcher === '_') return true // Skip underscore

    //todo: use Chips.disJoin to filter `args` by `isType`
    const isBoolStr   = isBooleanAsString(matcher) // True if `matcher` = 'false' or 'true'
    const matchObj    = OBJ_MATCH_REGEXP.exec(matcher) && args.some(a => isType('Object', a))
    const matchArr    = ARRAY_MATCH_REGEXP.exec(matcher)
    const matchRegExp = REGEXP_MATCH_REGEXP.exec(matcher)
    const matchStr    = !isBoolStr && args.includes(matcher)
    const matchNum    = !isBoolStr && args.includes(Number(matcher))
    const matchBool   =  isBoolStr && args.includes(JSON.parse(matcher))
    const matchNull   = !isBoolStr && args.includes(null) && matcher === 'null'
    const matchUndef  = !isBoolStr && args.includes(void 0) && matcher === 'undefined'
    const matchFn     = !isBoolStr && args.some(a => isType('Function', a))

    if      (matchObj)    return checkAllObjectCases(matcher, args.filter(a => isType('Object', a)))
    else if (matchArr)    return args.some(a => Array.isArray(a) && isSimilarLength(matchArr[0], a))
    else if (matchRegExp) return args.some(a => !isNullOrUndef(a) && new RegExp(matcher.replace(/\//g, '')).test(a))
    else if (matchBool)   return true
    else if (matchNum)    return true
    else if (matchNull)   return true
    else if (matchUndef)  return true
    else if (matchStr)    return true
    return false
}

// (Any|Function, [Any]) -> Any
const extractResult = (valOrFn, args) => isType('Function', valOrFn) ? valOrFn(...args) : valOrFn

// Object -> Function -> Any
module.exports = exports = exports.default = pattern => (...args) => {
    if (!args.length) throw new Error('No arguments supplied.')
    else if ('types' in pattern) checkTypes(pattern.types, args)
    const hasDefault = 'default' in pattern
    const tokens = hasDefault
        ? Object.keys(pattern).filter(k => k !== 'default')
        : Object.keys(pattern)
    const token = tokens.find(token => {
        const matchers = getMatchers(token) // [String]
        if (matchers.length !== args.length) return false /** @see getMatchers */
        else if (matchers.length === 1) return canMatchAnyArgs(matchers[0], args)
        return matchers.every(m => canMatchAnyArgs(m, args))
    })
    if (token !== void 0) return extractResult(pattern[token], args)
    else if (hasDefault) return extractResult(pattern.default, args)
    throw new Error('Non-exhaustive pattern, no matches found.')
}
