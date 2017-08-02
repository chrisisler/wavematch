const {
    OBJ_REGEXP
    , ARRAY_REGEXP
    , formatMatcher
    , formatArg
    , getMatchers
    , isBooleanStr
} = require('./util')

/**
 * Pattern matching consists of specifying patterns to which some data should conform to,
 * checking to see if it does, then acting on that input data based on the according function.
 * @throws {Error} - If no patterns matched and no `default` key in `pattern`.
 * @param {Object} pattern
 * @returns {Function(Any, ..., Any) -> Any}
 */
module.exports = exports = exports.default = pattern => (...args) => {
    const token = Object.keys(pattern).find(token => {
        const matchers = getMatchers(token) // Extract arguments (Array[String])

        // Skip current `token` if arity differs (depends on `getMatchers` correctly parsing all matchers)
        if (matchers.length !== args.length) return false

        return matchers.every(matcher => {
            const isBooleanMatcherString = isBooleanStr(matcher)

            // True if any arg in `args` has the exact same keys as `matcher` obj describes
            const objectMatch = OBJ_REGEXP.exec(matcher)
            const arrayMatch = ARRAY_REGEXP.exec(matcher)
            const booleanMatch = isBooleanMatcherString && args.includes(JSON.parse(matcher)) // (`JSON.parse` only safe to call if we know its a boolean)
            const numberMatch = !isBooleanMatcherString && args.find(a => Number(matcher) === a)
            const stringMatch = !isBooleanMatcherString && args.find(a => matcher === a)

            if (matcher === '_') return true // Skip underscore character
            else if (objectMatch) return !!args.find(a => formatMatcher(matcher) === formatArg(a))
            else if (arrayMatch) return true
            else if (booleanMatch) return true
            else if (numberMatch) return true
            else if (stringMatch) return true
            else {
                // New (type-based) logic added here
                return false
            }
        })
    })
    if (token != null) return pattern[token](...args)
    else if ('default' in pattern) return pattern.default(...args)
    throw new Error('Non-exhaustive pattern, no matches found.')
}
