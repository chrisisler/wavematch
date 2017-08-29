/**
 * Uses of this function are not interested in the contents of the strings,
 * just the number of strings described in the given `arrayMatcher`.
 * @example '[ foo, bar, x, ..., ]' -> [ 'foo', 'bar', 'x', '...' ]
 * @type {String -> [String]}
 */
const ARRAY_BRACKETS_REGEXP = /[\[\]\s]/g
const getArrayMatcherNames = arrayMatcher => arrayMatcher
    .replace(ARRAY_BRACKETS_REGEXP, '')
    .split(',')
    .filter(Boolean) // Allow trailing commas, nobody is perfect

/**
 * For array cases where the input described by some token is known to be greedy (include '...').
 * @type {(String, [[Any]], [String]) -> Boolean}
 */
const isCompatibleGreedyArrayMatcher = (arrayMatcher, argsArrays, tokens) => {
    // Either `undefined` or `[String]` :: The largest (most length-compatible) array from `tokens`
    const [ mostCompatibleTokenNames ] = tokens.reduce((acc, token) => { 
        const tokenNames = getArrayMatcherNames(token).filter(s => !s.includes('...'))
        const tokenLengthIsCompatible = argsArrays.some(inputArray => tokenNames.length <= inputArray.length)
        return tokenLengthIsCompatible === true ? acc.concat([tokenNames]) : acc // exclude incompatible tokens
    }, []).sort((a, b) => a.length < b.length) // Get largest sized array as first element (for destructuring)

    // `void 0` checks for emptiness (a destructured value from an empty array is undefined)
    const noCompatibleTokens = (mostCompatibleTokenNames === void 0) && argsArrays.some(arr => arr.length === 0)
    if (noCompatibleTokens === true) return false // Return false because no token is compatible

    const arrayMatcherNames = getArrayMatcherNames(arrayMatcher).filter(s => s !== '...')
    return mostCompatibleTokenNames.length === arrayMatcherNames.length
}

/**
 * For non-zero, N-length, and arbitrary-length matches
 * @type {(String, Any) -> Boolean}
 */
const isSimilarLength = (arrayMatcher, arg) =>
    arrayMatcher.includes('...')
        ? arg.length >= 0
        : arg.length === getArrayMatcherNames(arrayMatcher).length

/**
 * Checks all pattern matching situations/cases for some given matcher, `arrayMatcher`.
 * If `arrayMatcher` is greedy, check each token in `tokens` for compatibility based on length.
 *
 * @type {(String, [[String]], [String]) -> Boolean}
 * @param {String} arrayMatcher - A string like '[ key1, ... ]' which describes the desired input.
 * @param {[[String]]} argsArrays - The input arguments, filtered to contain only Arrays.
 * @param {[String]} tokens - Each key from `pattern`. (Equivalent to `Object.keys(pattern)`.)
 * @returns {Boolean} - True if the given `arrayMatcher` is compatible with any arg from `argsArrays` based on length.
 */
module.exports = (arrayMatcher, argsArrays, tokens) =>
    arrayMatcher.includes('...')
        ? isCompatibleGreedyArrayMatcher(arrayMatcher, argsArrays, tokens)
        : argsArrays.some(inputArray => isSimilarLength(arrayMatcher, inputArray))
