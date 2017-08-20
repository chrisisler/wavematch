const {
    OBJ_REGEXP
    , ARRAY_REGEXP
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
const isNullOrVoid = x => isType('Undefined', x) || isType('Null', x)

// For non-zero, N-length, and arbitrary-length matches
// (String, Any) -> Boolean
const similarLength = (arrayMatcher, arg) => arrayMatcher.includes('...')
    ? arg.length > 0
    : arg.length === getArrayMatcherLength(arrayMatcher)

// (String, Array[Any]) -> Boolean
const canMatchAnyArgs = (matcher, args) => {
    if (matcher === '_') return true // Skip underscore

    const matcherIsBooleanString = isBooleanStr(matcher)
    const objectMatch = OBJ_REGEXP.exec(matcher)
    const arrayMatch = ARRAY_REGEXP.exec(matcher)
    const booleanMatch = matcherIsBooleanString && args.includes(JSON.parse(matcher))
    const numberMatch = !matcherIsBooleanString && args.includes(Number(matcher))
    const nullMatch = !matcherIsBooleanString && args.includes(null)
    const undefinedMatch = !matcherIsBooleanString && args.includes(void 0)
    const stringMatch = !matcherIsBooleanString && args.includes(matcher)

    // if (objectMatch) return isIn(args, a => !isNullOrVoid(a) && hasIdenticalKeys(matcher, a))
    if (objectMatch) {
        const isArbitraryNonZeroKeys = objectMatch[0].includes('...') && isIn(args, a => !isNullOrVoid(a) && Object.keys(a).length > 0)
        if (isArbitraryNonZeroKeys) return true
        return isIn(args, a => !isNullOrVoid(a) && hasIdenticalKeys(matcher, a))
    }
    else if (arrayMatch) return isIn(args, a => !isNullOrVoid(a) && Array.isArray(a) && similarLength(arrayMatch[0], a))
    else if (booleanMatch) return true
    else if (numberMatch) return true
    else if (nullMatch) return true
    else if (undefinedMatch) return true
    else if (stringMatch) return true
    return false
}

// (String|Function, Array[Any]) -> Any
const extractResult = (valOrFn, args) => isType('Function', valOrFn) ? valOrFn(...args) : valOrFn

// Object -> Function -> Any
module.exports = exports = exports.default = pattern => (...args) => {
    if ('types' in pattern) checkTypes(pattern.types, args)
    const hasDefault = 'default' in pattern
    const tokens = hasDefault ? Object.keys(pattern).filter(k => k !== 'default') : Object.keys(pattern)
    const token = tokens.find(token => {
        const matchers = getMatchers(token) // Array[String]
        if (matchers.length !== args.length) return false /** @see getMatchers */
        else if (matchers.length === 1) return canMatchAnyArgs(matchers[0], args)
        return matchers.every(m => canMatchAnyArgs(m, args))
    })
    if (token != null) return extractResult(pattern[token], args)
    else if (hasDefault) return extractResult(pattern.default, args)
    throw new Error('Non-exhaustive pattern, no matches found.')
}
