const {
    OBJ_MATCH_REGEXP
    , REGEXP_MATCH_REGEXP
    , ARRAY_MATCH_REGEXP
    , isEqualStringArrays
    , isBooleanAsString
    , getMatchers
    , checkTypes
    , sortFn
    , isType
} = require('./util')
const checkAllObjectCases = require('./object-cases')

const ARRAY_BRACKETS_REGEXP = /[\[\]]/g

// String -> [String]
const getArrayMatcherNames = arrayMatcher => arrayMatcher
    .replace(ARRAY_BRACKETS_REGEXP, '')
    .split(',')
    .filter(Boolean)

// Any -> Boolean
const isNullOrUndef = x => isType('Undefined', x) || isType('Null', x)

// For non-zero, N-length, and arbitrary-length matches
// (String, Any) -> Boolean
const isSimilarLength = (arrayMatcher, arg) =>
    arrayMatcher.includes('...')
        ? arg.length >= 0
        : arg.length === getArrayMatcherNames(arrayMatcher).length

// The `tokens` array is only used for object-matching logic in `checkAllObjectCases`
// (String, [Any], [String]) -> Boolean
const canMatchAnyArgs = (matcher, args, tokens) => {
    if (matcher === '_') return true // Skip, wildcard is compatible with any input `args`

    const isBoolStr   = isBooleanAsString(matcher) // True if `matcher` = 'false' or 'true'
    const matchObj    = OBJ_MATCH_REGEXP.exec(matcher) && args.some(a => isType('Object', a))
    const matchArr    = ARRAY_MATCH_REGEXP.exec(matcher) && args.some(Array.isArray)
    const matchRegExp = REGEXP_MATCH_REGEXP.exec(matcher) && args.some(a => isType('RegExp', a))
    const matchStr    = !isBoolStr && args.includes(matcher) // todo
    const matchNum    = !isBoolStr && args.includes(Number(matcher))
    const matchBool   =  isBoolStr && args.includes(JSON.parse(matcher))
    const matchNull   = !isBoolStr && args.includes(null) && matcher === 'null'
    const matchUndef  = !isBoolStr && args.includes(void 0) && matcher === 'undefined'
    const matchFn     = !isBoolStr && args.some(a => isType('Function', a))

    if      (matchObj)    return checkAllObjectCases(matcher, args.filter(a => isType('Object', a)), tokens)
    // else if (matchArr)    return args.some(a => isSimilarLength(matcher, a))
    else if (matchArr) {
        const arrayMatcher = String(matcher)
        // const isGreedy = s => s.includes('...') // String|[String] -> Boolean :: todo
        if (arrayMatcher.includes('...')) {
            // compatibleTokenNames :: [[String]] :: Each (length-compatible) name from each token in `tokens`
            const compatibleTokenNames = tokens.reduce((acc, token) => { 
                const tokenNames = getArrayMatcherNames(token).filter(s => !s.includes('...')).map(s => s.trim())
                // console.log('tokenNames is:', tokenNames)
                // For token to be compatible, it has to have a num of names 
                const tokenLengthIsCompatible = args.some(inputArray => tokenNames.length <= inputArray.length)
                return tokenLengthIsCompatible === true ? acc.concat([tokenNames]) : acc // exclude incompatible tokens
            }, [])
            const arrayMatcherNames = getArrayMatcherNames(arrayMatcher).filter(s => s !== '...')
            if (args.some(inputArray => inputArray.length === 0) && compatibleTokenNames.length === 0) {
                // i dont know how this works
                return false
            }
            if (compatibleTokenNames.length === 1) return true // Greedyness doesn't matter if there's only one compatible token

            const [ mostSpecificTokenNames ] = compatibleTokenNames.sort((a, b) => a.length < b.length) // Get largest sized array

            // select the token with the highest length that is also smaller then args[0].length
            return mostSpecificTokenNames.length === arrayMatcherNames.length
        }
        return args.some(inputArray => isSimilarLength(arrayMatcher, inputArray))
    }
    else if (matchRegExp) return args.some(a => !isNullOrUndef(a) && new RegExp(arrayMatcher.replace(/\//g, '')).test(a))
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
