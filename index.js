const {
    objRegExp
    , arrayRegExp
    , formatMatcher
    , formatArg
    , getMatchers
} = require('./util')

/**
 * Pattern matching consists of specifying patterns to which some data should conform to,
 * checking to see if it does, then acting on that input data based on the according function.
 * @param {Object} pattern
 * @returns {Function(Any, ..., Any) -> Any}
 */
const match = pattern => (...args) => {

    // Attempt to match the given `args` for each matching token in `pattern`.
    const token = Object.keys(pattern).find(token => {

        // Function arguments are comma-delimited. `getMatchers` retrieves each argument from `token`.
        const matchers = getMatchers(token)

        // If the arity (num of args) of this token does not equal `args.length`, then skip this token.
        if (matchers.length !== args.length) return false

        return matchers.every(matcher => {
            // Skip underscore characer, we don't care what it matches.
            if (matcher === '_') return true

            // Object match. Return if any arg in `args` has the exact same keys as `matcher` obj describes
            else if (objRegExp.exec(matcher)) return !!args.find(a => formatMatcher(matcher) === formatArg(a))

            // Array match
            else if (arrayRegExp.exec(matcher)) return true //todo

            // Boolean match
            else if (['false', 'true'].includes(matcher) && args.includes(JSON.parse(matcher))) return true

            // String and Number (explicit/literal) match
            return !!args.find(a => matcher === a)
        })
    })
    if (token != null) {
        return pattern[token](...args)
    } else if ('default' in pattern) {
        return pattern.default(...args)
    }
    // throw new Error('Non-exhaustive pattern, no matches found.')
}
module.exports = match
