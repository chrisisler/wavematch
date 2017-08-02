// Do not change!
const OBJ_REGEXP = /{.*}/
const ARRAY_REGEXP = /\[.*\]/

// String -> Boolean
const isBooleanStr = str => (str === 'false') || (str === 'true')

// (String|Number, String|Number) -> Boolean
const sortFn = (a, b) => a < b

/** @example '{ y, x, }' -> 'x,y' */
// String -> String
const formatMatcher = m => m
    .replace(/[{}\s*]/g, '')
    .split(',')
    .filter(Boolean) // Removes empty strings caused by trailing commas
    .sort(sortFn)
    .join(',')

/** @example { y: 3, x: 'baz' } -> 'x,y' */
// Object -> String
const formatArg = arg => JSON.stringify(Object.keys(arg).sort(sortFn)).replace(/[\[\]"\s*]/g, '')

/** @example '_, { x, y }, foo, [ bar, baz ]' -> ['_', '{ x, y }', 'foo', '[ bar, baz ]'] */
// String -> Array[String]
const getMatchers = token => {
    const objMatch = OBJ_REGEXP.exec(token)
    const arrayMatch = ARRAY_REGEXP.exec(token)
    let mutableToken = String(token) // Clone the input
    let matchers = []

    // Remove sections of the string which describe Objects
    if (objMatch != null) {
        mutableToken = mutableToken.replace(OBJ_REGEXP, '')
        matchers.push(...objMatch[0].replace(/\s*/g, '').split(/,(?=\{)/g))
    }

    // Remove sections of the string which describe Arrays
    if (arrayMatch != null) {
        mutableToken = mutableToken.replace(ARRAY_REGEXP, '')
        matchers.push(...arrayMatch[0].replace(/\s*/g, '').split(/,(?=\[)/g))
    }

    // Retrieve matchers from the `token` String which do not describe Objects or Arrays.
    const otherMatchers = mutableToken.split(',').map(str => str.trim()).filter(Boolean)
    matchers.push(...otherMatchers)
    return matchers
}

module.exports = {
    OBJ_REGEXP
    , ARRAY_REGEXP
    , formatMatcher
    , formatArg
    , getMatchers
    , isBooleanStr
}
