const {
    OBJ_MATCH_REGEXP
    , REGEXP_MATCH_REGEXP
    , ARRAY_MATCH_REGEXP
    , isBooleanAsString
    // , hasIdenticalKeys
    , getMatchers
    , checkTypes
    , isType
} = require('./util')
const checkAllObjectCases = require('./object-cases')

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


// The `tokens` array is only used for object-matching logic in `checkAllObjectCases`
// (String, [Any], [String]) -> Boolean
const canMatchAnyArgs = (matcher, args, tokens) => {
    if (matcher === '_') return true // Skip, wildcard is compatible with any input `args`

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
    const tokens = hasDefault === true ? Object.keys(pattern).filter(k => k !== 'default') : Object.keys(pattern)
    const token = tokens.find(token => {
        const matchers = getMatchers(token)
        if (matchers.length !== args.length) return false // Skip arity mismatches. See `getMatchers`
        return matchers.every(m => canMatchAnyArgs(m, args, tokens))
    })
    if (token !== void 0) return extractResult(pattern[token], args)
    else if (hasDefault === true) return extractResult(pattern.default, args)
    throw new Error('Non-exhaustive pattern, no matches found.')
}
module.exports = exports = exports.default = wavematch
