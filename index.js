const {
    OBJ_REGEXP
    , ARRAY_REGEXP
    , hasIdenticalKeys
    , getMatchers
    , isBooleanStr
    , checkTypes
    , isIn
} = require('./util')

// const recursiveCache = {} // todo, see readme

// String -> Number
const getArrayMatcherLength = arrayMatcher => arrayMatcher
    .replace(/[\[\]]/g, '')
    .split(',')
    .filter(Boolean)
    .length

//todo: optimize `args.includes` and `args.find` calls to be a single call
// (String, Array[Any]) -> Boolean
const canMatchAnyArgs = (matcher, args) => {
    const matcherIsBooleanString = isBooleanStr(matcher)

    // True if any arg in `args` has the exact same keys as `matcher` obj describes
    const objectMatch = OBJ_REGEXP.exec(matcher)

    // `arrayMatch` is an Array[String] containing the grepped part of `matcher`, or null
    const arrayMatch = ARRAY_REGEXP.exec(matcher)
    ARRAY_REGEXP.flags

    // `JSON.parse` won't throw if we know its a boolean
    const booleanMatch = matcherIsBooleanString && args.includes(JSON.parse(matcher))
    const numberMatch = !matcherIsBooleanString && args.includes(Number(matcher))

    // `matcher` is inherently a String (cause it's a key from the `pattern` object)
    const stringMatch = !matcherIsBooleanString && args.includes(matcher) // Also, if it's not any of the above types, it's a String

    // const fnMatch = 'todo'

    // Skip underscore character
    if (matcher === '_') return true
    else if (objectMatch) {
        const foundObjectMatch = isIn(args, arg => hasIdenticalKeys(matcher, arg))
        return foundObjectMatch
    }
    else if (arrayMatch) {
        const desiredLength = getArrayMatcherLength(arrayMatch[0]) // Size of the desired Array
        const foundArrayMatch = isIn(args, arg => Array.isArray(arg) && arg.length === desiredLength)
        return foundArrayMatch
    }
    else if (booleanMatch) return true
    else if (numberMatch) return true
    else if (stringMatch) return true
    // else if (fnMatch) return true
    else {
        // todo: support functions
        // New (type-dependent) logic goes here
        return false
    }
}

/**
 * Pattern matching consists of specifying patterns to which some data should conform to,
 * checking to see if it does, then acting on that input based on some corresponding logic.
 * @throws {Error} - If no patterns matched and no `default` key in `pattern`.
 * @param {Object} pattern
 * @returns {Function(Any, ..., Any) -> Any}
 */
// const match
module.exports = exports = exports.default = pattern => (...args) => {
    // Type checking (may throw errors)
    // if ('types' in pattern) checkTypes(pattern.types, args)

    const hasDefault = 'default' in pattern
    const tokens = hasDefault ? Object.keys(pattern).filter(_ => _ !== 'default') : Object.keys(pattern)
    const token = tokens.find(token => {

        // Parse arguments (Array[String])
        const matchers = getMatchers(token)

        // Skip current `token` if arity differs (depends on `getMatchers` correctly parsing all matchers)
        if (matchers.length !== args.length) return false
        else if (matchers.length === 1) return canMatchAnyArgs(matchers[0], args)

        return matchers.every(matcher => canMatchAnyArgs(matcher, args))
    })
    if (token != null) return pattern[token](...args)
    else if (hasDefault) return pattern.default(...args)

    // Could provide better error messages by supplying `fn.name`
    throw new Error('Non-exhaustive pattern, no matches found.')
}

// console.log(
//     match({
//         '_, [], _': () => 'first array empty'
//         , '_, _, []': () => 'second array empty'
//         , default: () => 'DEFAULTED'
//     })('foo', false, [])
// )
