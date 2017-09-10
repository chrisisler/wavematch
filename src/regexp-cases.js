const { isType } = require('./util')

/**
 * Helper func for `checkAllRegExpCases`.
 * (I wish JS had a `where` keyword for internal functions like Haskell.)
 * @type {String -> RegExp}
 */
const getRegExpFromMatcher = matcher =>
    new RegExp(matcher.slice(1, matcher.length - 1))

/**
 * Checks all Regular Expression cases.
 * Either an arg is a regexp and `matcher` is String or `matcher` is a regexp and some arg is String.
 * @type {(String, [Any]) -> Boolean}
 */
module.exports = (matcher, args) =>
    args.some(arg =>
        isType('RegExp', arg) === true
            ? arg.test(matcher) === true
            : args.some(arg =>
                isType('String', arg) === true
                && getRegExpFromMatcher(matcher).test(arg) === true
                // && !OBJ_MATCH_REGEXP.test(arg) === true
                // && !ARR_MATCH_REGEXP.test(arg) === true
            )
    )
