const {
    OBJ_MATCH_REGEXP
    , ARRAY_MATCH_REGEXP
    , REGEXP_MATCH_REGEXP
    , hasIdenticalKeys
    , getMatchers
    , isBooleanAsString
    , checkTypes
    , isIn
    , isType
} = require('./util')

// const HAS_VALID_IDENTIFIER_REGEXP = /[a-zA-Z0-9_]+/

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

const getMatcherKeys = objMatcher => objMatcher
    .replace(/[}{\s]/g, '')
    .split(',')
    .filter(Boolean)

// ([String], [String]) -> Boolean. Maybe `.sort` both arrays?
const isEqualStringArrays = (xs, ys) => JSON.stringify(xs) === JSON.stringify(ys)

// ([Any], Any -> Boolean) -> [[Any], [Any]]
const partition = (xs, pred) =>
    xs.reduce((acc, x) => (acc[pred(x) ? 0 : 1].push(x), acc), [[], []])

// (String, [Any]) -> Boolean
const checkAllObjectCases = (matcher, args) => {
    const isInArgs = f => isIn(args, (a, i) => !!f(a, i) && !isNullOrUndef(a)) // Wrapper function to filter nil values. (Any -> Boolean) -> Boolean

    // Checks three cases (where `matcher` is known to satisfy the regexp /{.*}/ and `args` contains an Object):
    //    (1) '{...}'       (zero named keys && zero unnamed keys)
    //    (2) '{x, _, ...}' (one or more named keys && one or more unnamed keys)
    //    (3) '{x, ...}'    (one or more named keys && zero unnamed keys)
    //    (4) '{_, ...}'    (one or more unnamed keys && zero named keys)
    if (matcher.includes('...')) {
        const desiredKeys = getMatcherKeys(matcher).filter(s => s !== '...')

        // Case (1)
        if (desiredKeys.length === 0) return true

        const [ unnamedKeys, namedKeys ] = partition(desiredKeys, s => s === '_')

        // Case (2)
        if (unnamedKeys.length && namedKeys.length) {
        }
        // Case (3)
        else if (namedKeys.length) {
            const out = args.some(a => namedKeys.every(k => Object.keys(a).includes(k)))
            return out
        }
        // Case (4)
        else if (unnamedKeys.length) {
        }

        
















        /*
        const desiredKeys = getMatcherKeys(matcher).filter(s => s !== '...')
        if (desiredKeys.length === 0)  //todo

        //todo handle case where `matcher` includes _ and ,
        if (matcher.includes('_')) {
            //todo
        }
        else if (!matcher.includes(',')) return true // case: "{...}" = zero or more of any name

        const out = desiredKeys.every(dKey => Object.keys(args[0]).includes(dKey))
        console.log('out is:', out)
        return out
        */
    }

    // Matches empty objects and objects with name-dependent keys (no "_") 
    const argsHasObjWithDesiredKeys = isInArgs(a => isEqualStringArrays(Object.keys(a), getMatcherKeys(matcher)))
    if (argsHasObjWithDesiredKeys) return true

    // exactly one of any name
    // exactly two of any name
    return false
}

// (String, [Any]) -> Boolean
const canMatchAnyArgs = (matcher, args) => {
    if (matcher === '_') return true // Skip underscore

    //todo: use Chips.disJoin to filter `args` by `isType`
    const isBoolStr   = isBooleanAsString(matcher)
    const matchObj    = OBJ_MATCH_REGEXP.exec(matcher) && args.some(a => isType('Object', a))
    const matchArr    = ARRAY_MATCH_REGEXP.exec(matcher)
    const matchRegExp = REGEXP_MATCH_REGEXP.exec(matcher)
    const matchStr    = !isBoolStr && args.includes(matcher)
    const matchNum    = !isBoolStr && args.includes(Number(matcher))
    const matchBool   =  isBoolStr && args.includes(JSON.parse(matcher))
    const matchNull   = !isBoolStr && args.includes(null) && matcher === 'null'
    const matchUndef  = !isBoolStr && args.includes(void 0) && matcher === 'undefined'
    // const matchFn     = !isBoolStr && // todo

    if      (matchObj)    return checkAllObjectCases(matcher, args)
    else if (matchArr)    return isIn(args, a => Array.isArray(a) && isSimilarLength(matchArr[0], a))
    else if (matchRegExp) return isIn(args, a => !isNullOrUndef(a) && new RegExp(matcher.replace(/\//g, '')).test(a))
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
    if ('types' in pattern) checkTypes(pattern.types, args)
    const hasDefault = 'default' in pattern
    const tokens = hasDefault === true ? Object.keys(pattern).filter(k => k !== 'default') : Object.keys(pattern)
    const token = tokens.find(token => {
        const matchers = getMatchers(token) // [String]
        if (matchers.length !== args.length) return false /** @see getMatchers */
        else if (matchers.length === 1) return canMatchAnyArgs(matchers[0], args)
        return matchers.every(m => canMatchAnyArgs(m, args))
    })
    if (token !== void 0) return extractResult(pattern[token], args)
    else if (hasDefault === true) return extractResult(pattern.default, args)
    throw new Error('Non-exhaustive pattern, no matches found.')
}
