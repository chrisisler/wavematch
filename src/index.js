const {
    OBJ_MATCH_REGEXP
    , REGEXP_MATCH_REGEXP
    , ARRAY_MATCH_REGEXP
    , isBooleanAsString
    , hasIdenticalKeys
    , getMatchers
    , checkTypes
    , isType
    , sortFn
} = require('./util')

const ARRAY_BRACKETS_REGEXP = /[\[\]]/g

// String -> Number
const getArrayMatcherLength = arrayMatcher => arrayMatcher
    .replace(ARRAY_BRACKETS_REGEXP, '')
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

// (String, {length}, {length}) -> Boolean
const compare = (op, x, y) => wavematch({
    '===': x.length === y.length
    , '>=': x.length >= y.length
}).call(null, op)

/**
 * Check cases where `objMatcher` satisfies the regexp /{.*}/ and `args` contains an Object
 * '{...}', '{x, _, ...}', '{x, ...}', '{_, ...}'
 * '{}',    '{x, _}',      '{x}',      '{_}'
 */
// (String, [Object], [String]) -> Boolean
const checkAllObjectCases = (objMatcher, args, tokens) => {
    // Don't have to check `if (args.length === 0) return false`, see `canMatchAnyArgs`
    const isGreedy = objMatcher.includes('...')
    const keys = getObjMatcherKeys(objMatcher).filter(s => s !== '...')
    const [ unnamed, named ] = partition(keys, s => s === '_')
    const argsKeys = args.map(Object.keys) // [[Strings]]

    // Impure function, uses `sortFn`.
    // If arg keys are length N, return true if there are some arbitrary keys of that same length.
    // (Boolean, [String], [String], [[String]]) -> Boolean
    const fn = (isUnnamedKeyType, matcherKeys, argsKeys, tokens) => {
        // For dynamically extracting the desired type of keys (named vs. unnamed) from each token in `tokens`. (impure func)
        const isDesiredKeyType = s => (isUnnamedKeyType === true) ? (s === '_') : (s !== '_') // String -> Boolean

        const compatibleMatchersKeys = tokens.reduce((acc, token) => { // [[String]]
            const _keys = getObjMatcherKeys(token).filter(s => s !== '...' && isDesiredKeyType(s))
            const tokenIsCompatible = (isUnnamedKeyType === true)
                ? argsKeys.some(argKeys => _keys.length <= argKeys.filter(argKey => !named.includes(argKey)).length)
                : argsKeys.some(argKeys => _keys.length <= argKeys.length && _keys.every(mKey => argKeys.includes(mKey)))
            return tokenIsCompatible === true ? acc.concat([_keys]) : acc // map and filter simultaneously
        }, [])

        if (compatibleMatchersKeys.length === 1) return true

        const [ mostSpecificTokensKeys ] = compatibleMatchersKeys.sort(sortFn) // Get the largest sized array
        return isEqualStringArrays(mostSpecificTokensKeys, matcherKeys)
    }

    const zeroKeys = !named.length && !unnamed.length && argsKeys.some(argsKeys => !argsKeys.length) && objMatcher === '{}'
    const zeroOrGreedyKeys = isGreedy === true && !(named.length !== 0 || unnamed.length !== 0)
    if (zeroKeys === true || zeroOrGreedyKeys === true) {
        return true
    } else if (unnamed.length && named.length) { // Todo: support `isGreedy` compare function
        const someArgHasAllNamedKeys = named.every(name => argsKeys.some(argsKeys => argsKeys.includes(name) && argsKeys.length >= named.length))
        const someArgHasAllUnnamedKeys = argsKeys.some(argsKeys => unnamed.length <= argsKeys.filter(k => !named.includes(k)).length)
        return someArgHasAllNamedKeys && someArgHasAllUnnamedKeys
    } else if (named.length) {
        // If greedy matching ('...'), match as many keys as possible for each obj in `args`.
        if (isGreedy === true) {
            return fn(false, named, argsKeys, tokens)
        }
        return named.every(k => argsKeys.some(argKeys => argKeys.includes(k) && argKeys.length === named.length))
    } else if (unnamed.length) {

        // If greedy matching ('...'), match as many keys as possible for each obj in `args`.
        if (isGreedy === true) {
            return fn(true, unnamed, argsKeys, tokens)
        }
        return argsKeys.some(argKeys => unnamed.length === argKeys.filter(k => !named.includes(k)).length)
    }


    throw new Error('Something went wrong.')
}

// The `tokens` array is only used for object-matching logic in `checkAllObjectCases`
// (String, [Any], [String]) -> Boolean
const canMatchAnyArgs = (matcher, args, tokens) => {
    if (matcher === '_') return true // Skip underscore

    //todo: use Chips.disJoin to filter `args` by `isType`
    const isBoolStr   = isBooleanAsString(matcher) // True if `matcher` = 'false' or 'true'
    const matchObj    = OBJ_MATCH_REGEXP.exec(matcher) && args.some(a => isType('Object', a))
    const matchArr    = ARRAY_MATCH_REGEXP.exec(matcher) && args.some(a => isType('Array', a))
    const matchRegExp = REGEXP_MATCH_REGEXP.exec(matcher) && args.some(a => isType('RegExp', a))
    const matchStr    = !isBoolStr && args.includes(matcher) // todo
    const matchNum    = !isBoolStr && args.includes(Number(matcher))
    const matchBool   =  isBoolStr && args.includes(JSON.parse(matcher))
    const matchNull   = !isBoolStr && args.includes(null) && matcher === 'null'
    const matchUndef  = !isBoolStr && args.includes(void 0) && matcher === 'undefined'
    const matchFn     = !isBoolStr && args.some(a => isType('Function', a))

    if      (matchObj)    return checkAllObjectCases(matcher, args.filter(a => isType('Object', a)), tokens)
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
const wavematch = pattern => (...args) => {
    if (!args.length) throw new Error('No arguments supplied.')
    else if ('types' in pattern) checkTypes(pattern.types, args)
    const hasDefault = 'default' in pattern
    const tokens = hasDefault === true
        ? Object.keys(pattern).filter(k => k !== 'default')
        : Object.keys(pattern)
    const token = tokens.find(token => {
        const matchers = getMatchers(token)
        // Skip the token/key/matchers if the arity doesn't match. See: `getMatchers`
        if (matchers.length !== args.length) return false
        return matchers.every(m => canMatchAnyArgs(m, args, tokens))
    })
    if (token !== void 0) return extractResult(pattern[token], args)
    else if (hasDefault === true) return extractResult(pattern.default, args)
    throw new Error('Non-exhaustive pattern, no matches found.')
}
module.exports = exports = exports.default = wavematch
