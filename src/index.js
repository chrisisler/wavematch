const {
    OBJ_MATCH_REGEXP
    , REGEXP_MATCH_REGEXP
    , ARRAY_MATCH_REGEXP
    , isBooleanAsString
    , getMatchers
    , checkTypes
    , isType
} = require('./util')
const checkAllObjectCases = require('./object-cases')
const checkAllArrayCases = require('./array-cases')

/** @type {Any -> Boolean} */
const isNullOrUndef = x => isType('Undefined', x) || isType('Null', x)

/**
 * Handles type-dependent branching logic for verifying if `matcher` is somehow compatible.
 * @type {(String, [Any], [String]) -> Boolean}
 */
const isCompatible = (matcher, args, tokens) => {
    if (matcher === '_') return true // Skip, wildcard is compatible with any input 

    const isBoolStr   = isBooleanAsString(matcher) // True if `matcher` = 'false' or 'true'
    const matchObj    = OBJ_MATCH_REGEXP.exec(matcher) && args.some(a => isType('Object', a))
    const matchArr    = ARRAY_MATCH_REGEXP.exec(matcher) && args.some(Array.isArray)
    const matchRegExp = REGEXP_MATCH_REGEXP.exec(matcher) && args.some(a => isType('RegExp', a))
    const matchStr    = !isBoolStr && args.includes(matcher) // todo
    const matchNum    = !isBoolStr && args.includes(Number(matcher))
    const matchBool   =  isBoolStr && args.includes(JSON.parse(matcher))
    const matchNull   = !isBoolStr && args.includes(null) && matcher === 'null'
    const matchUndef  = !isBoolStr && args.includes(void 0) && matcher === 'undefined'
    // const matchFn     = !isBoolStr && args.some(a => isType('Function', a)) // todo

    if      (matchObj)    return checkAllObjectCases(matcher, args.filter(a => isType('Object', a)), tokens)
    else if (matchArr)    return checkAllArrayCases(matcher, args.filter(Array.isArray), tokens)
    else if (matchRegExp) return args.some(a => !isNullOrUndef(a) && new RegExp(matcher.replace(/\//g, '')).test(a))
    else if (matchBool)   return true
    else if (matchNum)    return true
    else if (matchNull)   return true
    else if (matchUndef)  return true
    else if (matchStr)    return true //todo: allow spaces in single/double-quote delimited strings
    return false
}

/**
 * Allows values from `pattern` to either be a value to return or a function to apply to `args` then return.
 * @type {(Any|Function, [Any]) -> Any}
 */
const extractResult = (valOrFn, args) => isType('Function', valOrFn) ? valOrFn(...args) : valOrFn

/**
 * Compare input data against desired structures to check for compatibility.
 * If a match is compatible, the corresponding expression is executed.
 * Return a fixed value or apply a function to the arguments.
 *
 * @throws {Error|TypeError} - If all `pattern` cases are incompatible.
 * @type {Object -> ([Any] -> Any)}
 * @param {Object} pattern - Each key describes some desired input. Each value responds accordingly. 
 * @returns {Function([Any]) -> Any} - Returns an anonymous function. Allows for re-using some `patern`.
 *     @param {[Any]} args - All input. Verified per pattern case for type-dependent compatibility.
 *     @returns {Any} - From `pattern`. Either a value or a function which gets applied to `args`.
 */
module.exports = exports = exports.default = pattern => (...args) => {
    if (!args.length) throw new Error('No arguments supplied.')
    else if ('types' in pattern) checkTypes(pattern.types, args)
    const hasDefault = 'default' in pattern
    const tokens = hasDefault === true ? Object.keys(pattern).filter(k => k !== 'default') : Object.keys(pattern)
    const token = tokens.find(token => {
        const matchers = getMatchers(token) // [String]
        if (matchers.length !== args.length) return false // Skip arity mismatches. See `getMatchers`
        return matchers.every(matcher => isCompatible(matcher, args, tokens))
    })
    if (token !== void 0) return extractResult(pattern[token], args)
    else if (hasDefault === true) return extractResult(pattern.default, args)
    throw new Error('Non-exhaustive pattern, no matches found.')
}
