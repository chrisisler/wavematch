const { sortFn, isEqualStringArrays } = require('./util')

// ([Any], Any -> Boolean) -> [[Any], [Any]]
const partition = (xs, pred) =>
    xs.reduce((acc, x) => (acc[pred(x) ? 0 : 1].push(x), acc), [[], []])

// String -> [String]
const getObjMatcherKeys = objMatcher => objMatcher
    .replace(/[}{\s]/g, '')
    .split(',')
    .filter(Boolean)

// If arg keys are length N, return true if there are some arbitrary keys of that same length.
// (Boolean, [String], [String], [[String]]) -> Boolean
const isCompatibleGreedyObjectMatcher = (isUnnamedKeyType, objMatcherKeys, argsKeys, tokens) => {
    // For dynamically extracting the desired type of keys (named vs. unnamed) from each token in `tokens`. (impure func)
    const isDesiredKeyType = s => (isUnnamedKeyType === true) ? (s === '_') : (s !== '_') // String -> Boolean

    // compatibleMatchersKeys :: [[String]] :: Each (un/named) key from each token in `tokens`
    const compatibleMatchersKeys = tokens.reduce((acc, token) => {
        const _keys = getObjMatcherKeys(token).filter(s => s !== '...' && isDesiredKeyType(s))
        const tokenIsCompatible = (isUnnamedKeyType === true)
            ? argsKeys.some(argKeys => _keys.length <= argKeys.filter(argKey => !objMatcherKeys.includes(argKey)).length)
            : argsKeys.some(argKeys => _keys.length <= argKeys.length && _keys.every(mKey => argKeys.includes(mKey)))
        return tokenIsCompatible === true ? acc.concat([_keys]) : acc // map and filter simultaneously
    }, [])

    if (compatibleMatchersKeys.length === 1) return true

    const [ mostSpecificTokensKeys ] = compatibleMatchersKeys.sort(sortFn) // Get the largest sized array
    return isEqualStringArrays(mostSpecificTokensKeys, objMatcherKeys)
}

/**
 * Check cases where `objMatcher` satisfies the regexp /{.*}/ and `args` contains an Object
 * '{...}', '{x, _, ...}', '{x, ...}', '{_, ...}'
 * '{}',    '{x, _}',      '{x}',      '{_}'
 */
// (String, [Object], [String]) -> Boolean
const checkAllObjectCases = (objMatcher, args, tokens) => {
    const isGreedy = objMatcher.includes('...')
    const keys = getObjMatcherKeys(objMatcher).filter(s => s !== '...')
    const [ unnamed, named ] = partition(keys, s => s === '_')
    const argsKeys = args.map(Object.keys) // [[Strings]]

    const zeroKeys = !named.length && !unnamed.length && argsKeys.some(argsKeys => !argsKeys.length) && objMatcher === '{}'
    const zeroOrGreedyKeys = isGreedy === true && !(named.length !== 0 || unnamed.length !== 0)
    if (zeroKeys === true || zeroOrGreedyKeys === true) {
        return true
    }
    else if (unnamed.length && named.length) {
        const someArgHasAllNamedKeys = named.every(name => argsKeys.some(argsKeys => argsKeys.includes(name) && argsKeys.length >= named.length))
        const someArgHasAllUnnamedKeys = argsKeys.some(argKeys => argKeys.filter(k => !named.includes(k)).length >= unnamed.length)
        return someArgHasAllNamedKeys && someArgHasAllUnnamedKeys
    } else if (named.length) {
        return (isGreedy === true)
            ? isCompatibleGreedyObjectMatcher(false, named, argsKeys, tokens)
            : named.every(k => argsKeys.some(argKeys => argKeys.includes(k) && argKeys.length === named.length))
    } else if (unnamed.length) {
        return (isGreedy === true)
            ? isCompatibleGreedyObjectMatcher(true, unnamed, argsKeys, tokens)
            : argsKeys.some(argKeys => unnamed.length === argKeys.filter(k => !named.includes(k)).length)
    }
    throw new Error('Something went wrong.')
}

module.exports = checkAllObjectCases
