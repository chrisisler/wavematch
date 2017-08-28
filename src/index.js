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
const getObjMatcherKeys = objMatcher => objMatcher
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
    if (!args.length) return false
    const keys = getObjMatcherKeys(matcher).filter(s => s !== '...')
    const [ unnamedKeys, namedKeys ] = partition(keys, s => s === '_')

    // (Any -> Boolean) -> Boolean
    const someArgKeys = predicate => args.some(a => predicate(Object.keys(a)))

    const zeroKeys = !namedKeys.length && !unnamedKeys.length && someArgKeys(ks => !ks.length)
    if (zeroKeys) {
        // console.log('a')
        return true
    } else if (unnamedKeys.length && namedKeys.length) {
        // console.log('b')
        const someArgObjHasEveryNamedKey = namedKeys.every(k => someArgKeys(ks => ks.includes(k) && ks.length >= namedKeys.length))
        const someArgObjHasEveryUnnamedKey = someArgKeys(ks => unnamedKeys.length <= ks.filter(k => !namedKeys.includes(k)).length)
        return someArgObjHasEveryNamedKey && someArgObjHasEveryUnnamedKey
    } else if (namedKeys.length) {
        // console.log('c')

        // console.log('keys is:', keys)
        // console.log('Object.keys(args[0]) is:', Object.keys(args[0]))
        // console.log('someArgObjHasEveryNamedKey is:', someArgObjHasEveryNamedKey)
        // console.log('someArgObjHasEveryUnnamedKey is:', someArgObjHasEveryUnnamedKey)
        // console.log()

        return matcher.includes('...')
            ? namedKeys.every(k => someArgKeys(ks => ks.includes(k) && ks.length >= namedKeys.length))
            : namedKeys.every(k => someArgKeys(ks => ks.includes(k) && ks.length === namedKeys.length))
    } else if (unnamedKeys.length) {
        // console.log('d')
        return matcher.includes('...')
            ? someArgKeys(ks => unnamedKeys.length <= ks.filter(k => !namedKeys.includes(k)).length)
            : someArgKeys(ks => unnamedKeys.length === ks.filter(k => !namedKeys.includes(k)).length)
    } else {
        // console.log('e')
    }
}

// (String, [Any]) -> Boolean
const canMatchAnyArgs = (matcher, args) => {
    if (matcher === '_') return true // Skip underscore

    //todo: use Chips.disJoin to filter `args` by `isType`
    const isBoolStr   = isBooleanAsString(matcher) // True if `matcher` = 'false' or 'true'
    const matchObj    = OBJ_MATCH_REGEXP.exec(matcher) && args.some(a => isType('Object', a))
    const matchArr    = ARRAY_MATCH_REGEXP.exec(matcher) && args.some(a => isType('Array', a))
    const matchRegExp = REGEXP_MATCH_REGEXP.exec(matcher) && args.some(a => isType('RegExp', a))
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
    else if (matchStr)    return true //todo: allow spaces in single/double-quote delimited strings
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
