const checkAllObjectCases = require('./object-cases')
const checkAllArrayCases = require('./array-cases')
const checkAllRegExpCases = require('./regexp-cases')
const {
    OBJ_MATCH_REGEXP
    , REGEXP_MATCH_REGEXP
    , ARR_MATCH_REGEXP
    , isBooleanAsString
    , getMatchers
    , isType
} = require('./util')

/** @type {Any -> Boolean} */
const isNullOrUndef = x => isType('Undefined', x) || isType('Null', x)

// Handles type-dependent branching logic for verifying if `matcher` is somehow compatible.
/** @type {(String, [Any], [String]) -> Boolean} */
const isCompatible = (matcher, args, tokens) => {
    if (matcher === '_') return true // Skip, wildcard is always compatible

    const isBoolStr = isBooleanAsString(matcher) // True if `matcher` = 'false' or 'true'

    const matchObj    = OBJ_MATCH_REGEXP.exec(matcher) && args.some(isType('Object'))
    const matchArr    = ARR_MATCH_REGEXP.exec(matcher) && args.some(Array.isArray)
    const matchRegExp = (REGEXP_MATCH_REGEXP.test(matcher) || args.some(isType('RegExp'))) 
                        // && !matchObj && !matchArr // ----- DEBUGGING -----
    const matchStr    = !isBoolStr && args.includes(matcher) // todo
    const matchNum    = !isBoolStr && args.includes(Number(matcher))
    const matchBool   =  isBoolStr && args.includes(JSON.parse(matcher))
    const matchNull   = !isBoolStr && args.includes(null) && matcher === 'null'
    const matchUndef  = !isBoolStr && args.includes(void 0) && matcher === 'undefined'
    // const matchFn     = !isBoolStr && args.some(isType('Function')) // todo

    if      (matchObj)    return checkAllObjectCases(matcher, args.filter(isType('Object')), tokens) 
    else if (matchArr)    return checkAllArrayCases(matcher, args.filter(Array.isArray), tokens) 
    else if (matchRegExp) return checkAllRegExpCases(matcher, args.filter(isType('RegExp'))) 
    else if (matchBool)   return true
    else if (matchNum)    return true
    else if (matchNull)   return true
    else if (matchUndef)  return true
    else if (matchStr)    return true //todo: allow spaces in single/double-quote delimited strings
    return false
}

// Allows values from `pattern` to either be a value to return or a function to apply to `args` then return.
/** @type {(Any|Function, [Any]) -> Any} */
const extractResult = (valOrFn, args) =>
    isType('Function', valOrFn)
        ? valOrFn(...args)
        : valOrFn

/**
 * Apply one or more functions to (key-specified) `args` and return the result.
 * @example applyTransform((...args) => doStuff(args), arg1, arg2, ..., argN)
 * @example applyTransform({ 2: argAtIndex2 => doStuff(argAtIndex2) }, arg1, arg2, ..., argN)
 * @type {(Function|Object, [Any]) -> Any}
 * @todo - Is this needed?
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
module.exports = (pattern={}) => (...args) => {
    if (args.length === 0) throw new Error('No arguments supplied.')
    // else if ('transform' in pattern) args = applyTransform(pattern.transform, args)

    const hasDefault = 'default' in pattern
    const tokens = hasDefault === true
        ? Object.keys(pattern).filter(k => k !== 'default')
        : Object.keys(pattern)
    const token = tokens.find(token => {
        const matchers = getMatchers(token)
        if (matchers.length !== args.length) return false // Skip arity-incompatible tokens
        const bool = matchers.every(matcher => isCompatible(matcher, args, tokens))
        return bool
    })
    if (token !== void 0) return extractResult(pattern[token], args)
    else if (hasDefault === true) return extractResult(pattern.default, args)
    throw new Error('Non-exhaustive pattern, no matches found.')
}
