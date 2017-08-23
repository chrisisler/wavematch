const {
    OBJ_MATCH_REGEXP
    , ARRAY_MATCH_REGEXP
    , REGEXP_MATCH_REGEXP
    , hasIdenticalKeys
    , getMatchers
    , isBooleanStr
    , checkTypes
    , isIn
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

// (String, Array[Any]) -> Boolean
const checkAllObjectCases = (matcher, args) => {
    // Function (Any -> Boolean) -> Boolean
    const isInArgs = f => isIn(args, (a, i) => !!f(a, i) && !isNullOrUndef(a)) // Wrapper function to filter nil values

    // empty {}
    const zeroKeys = m => isInArgs(a => Object.keys(a).length === 0 && m.replace(/,/g, '') === '{}') // String -> Boolean
    if (zeroKeys(matcher)) return true

    // exactly x
    // exactly x and y
    // ... zero or more  of any name
    // exactly x and zero or more of any name
    // exactly x, y, and zero or more of any name
    // exactly one of any name
    // exactly two of any name
    // exactly one of any name and zero or more of any name
}

// (String, Array[Any]) -> Boolean
const canMatchAnyArgs = (matcher, args) => {
    if (matcher === '_') return true // Skip underscore

    const isBoolStr = isBooleanStr(matcher)

    // obj arr bool num null undef str (todo: function)
    const matchObj    = OBJ_MATCH_REGEXP.exec(matcher)
    const matchArr    = ARRAY_MATCH_REGEXP.exec(matcher)
    const matchRegExp = REGEXP_MATCH_REGEXP.exec(matcher)
    const matchStr    = !isBoolStr && args.includes(matcher)
    const matchNum    = !isBoolStr && args.includes(Number(matcher))
    const matchBool   =  isBoolStr && args.includes(JSON.parse(matcher))
    const matchNull   = !isBoolStr && args.includes(null) && matcher === 'null'
    const matchUndef  = !isBoolStr && args.includes(void 0) && matcher === 'undefined'

    if (matchObj) { // Note: matchObj[0] === matcher
        return checkAllObjectCases(matcher, args)
    }
    else if (matchArr)    return isIn(args, a => !isNullOrUndef(a) && Array.isArray(a) && isSimilarLength(matchArr[0], a))
    else if (matchRegExp) return isIn(args, a => !isNullOrUndef(a) && new RegExp(matcher.replace(/\//g, '')).test(a))
    else if (matchBool)   return true
    else if (matchNum)    return true
    else if (matchNull)   return true
    else if (matchUndef)  return true
    else if (matchStr)    return true
    return false
}

// (Any|Function, Array[Any]) -> Any
const extractResult = (valOrFn, args) => isType('Function', valOrFn) ? valOrFn(...args) : valOrFn

// Object -> Function -> Any
module.exports = exports = exports.default = pattern => (...args) => {
    if ('types' in pattern) checkTypes(pattern.types, args)
    const hasDefault = 'default' in pattern
    const tokens = hasDefault === true ? Object.keys(pattern).filter(k => k !== 'default') : Object.keys(pattern)
    const token = tokens.find(token => {
        const matchers = getMatchers(token) // Array[String]
        if (matchers.length !== args.length) return false /** @see getMatchers */
        else if (matchers.length === 1) return canMatchAnyArgs(matchers[0], args)
        return matchers.every(m => canMatchAnyArgs(m, args))
    })
    if (token !== void 0) return extractResult(pattern[token], args)
    else if (hasDefault === true) return extractResult(pattern.default, args)
    throw new Error('Non-exhaustive pattern, no matches found.')
}
