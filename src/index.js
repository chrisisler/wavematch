const {
    OBJ_MATCH_REGEXP
    , REGEXP_MATCH_REGEXP
    , ARRAY_MATCH_REGEXP
    , isBooleanAsString
    , getMatchers
    , isType
} = require('./util')
const checkAllObjectCases = require('./object-cases')
const checkAllArrayCases = require('./array-cases')

/** @type {Any -> Boolean} */
const isNullOrUndef = x => isType('Undefined', x) || isType('Null', x)

// Helper func for `checkAllRegExpCases`
/** @type {String -> RegExp} */
const getRegExpFromMatcher = matcher => new RegExp(matcher.slice(1, matcher.length - 1))
// Either an arg is a regexp and `matcher` is String or `matcher` is a regexp and some arg is String.
/** @type {(String, [Any]) -> Boolean} */
const checkAllRegExpCases = (matcher, args) =>
    args.some(arg =>
        isType('RegExp', arg) === true
            ? arg.test(matcher)
            : args.some(arg => isType('String', arg) && getRegExpFromMatcher(matcher).test(arg))
    )

// Handles type-dependent branching logic for verifying if `matcher` is somehow compatible.
/** @type {(String, [Any], [String]) -> Boolean} */
const isCompatible = (matcher, args, tokens) => {
    if (matcher === '_') return true // Skip, wildcard is always compatible

    const isBoolStr = isBooleanAsString(matcher) // True if `matcher` = 'false' or 'true'

    const matchObj    = OBJ_MATCH_REGEXP.exec(matcher) && args.some(a => isType('Object', a))
    const matchArr    = ARRAY_MATCH_REGEXP.exec(matcher) && args.some(Array.isArray)
    const matchStr    = !isBoolStr && args.includes(matcher) // todo
    const matchNum    = !isBoolStr && args.includes(Number(matcher))
    const matchBool   =  isBoolStr && args.includes(JSON.parse(matcher))
    const matchNull   = !isBoolStr && args.includes(null) && matcher === 'null'
    const matchUndef  = !isBoolStr && args.includes(void 0) && matcher === 'undefined'
    // const matchFn     = !isBoolStr && args.some(a => isType('Function', a)) // todo

    if      (matchObj)    return checkAllObjectCases(matcher, args.filter(a => isType('Object', a)), tokens)
    else if (matchArr)    return checkAllArrayCases(matcher, args.filter(Array.isArray), tokens)
    else if (matchBool)   return true
    else if (matchNum)    return true
    else if (matchNull)   return true
    else if (matchUndef)  return true
    else if (matchStr)    return true //todo: allow spaces in single/double-quote delimited strings
    else if (checkAllRegExpCases(matcher, args) === true) return true
    return false
}

// Allows values from `pattern` to either be a value to return or a function to apply to `args` then return.
/** @type {(Any|Function, [Any]) -> Any} */
const extractResult = (valOrFn, args) => isType('Function', valOrFn) ? valOrFn(...args) : valOrFn

/**
 * Apply one or more functions to (key-specified) `args` and return the result.
 * @example applyTransform((...args) => doStuff(args), arg1, arg2, ..., argN)
 * @example applyTransform({ 2: argAtIndex2 => doStuff(argAtIndex2) }, arg1, arg2, ..., argN)
 * @type {(Function|Object, [Any]) -> Any}
 * @todo
 */
// const applyTransform = (transform, args) =>
//     isType('Function', transform)
//         ? transform(...args)
//         : args.map((arg, idx) => transform[idx] ? transform[idx](arg) : arg)

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
module.exports = exports = exports.default = (pattern={}) => (...args) => {
    if (args.length === 0) throw new Error('No arguments supplied.')
    // else if ('transform' in pattern) args = applyTransform(pattern.transform, args)

    const hasDefault = 'default' in pattern
    const tokens = hasDefault === true
        ? Object.keys(pattern).filter(k => k !== 'default')
        : Object.keys(pattern)
    const token = tokens.find(token => {
        const matchers = getMatchers(token)
        if (matchers.length !== args.length) return false // Skip arity-incompatible tokens
        return matchers.every(matcher => isCompatible(matcher, args, tokens))
    })

    if (token !== void 0) return extractResult(pattern[token], args)
    else if (hasDefault === true) return extractResult(pattern.default, args)
    throw new Error('Non-exhaustive pattern, no matches found.')
}
