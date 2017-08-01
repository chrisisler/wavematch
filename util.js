const objRegExp = /{.*}/g
const arrayRegExp = /\[.*\]/g

// (String|Number, String|Number) -> Boolean
const sortFn = (a, b) => a < b

// String -> String
/** @example '{ y, x }' -> 'x,y' */
const formatMatcher = m => m.replace(/[{}\s*]/g, '').split(',').sort(sortFn).join(',')

// Object -> String
/** @example { y: 3, x: 'baz' } -> 'x,y' */
const formatArg = arg => JSON.stringify(Object.keys(arg).sort(sortFn)).replace(/[\[\]"\s*]/g, '')

/** @example '_, { x, y }, foo, [ bar, baz ]' -> ['_', '{ x, y }', 'foo', '[ bar, baz ]'] */
// String -> Array[String]
const getMatchers = token => {
    const objMatch = objRegExp.exec(token)
    const arrayMatch = arrayRegExp.exec(token)
    let mutableToken = String(token) // Clone the input
    let matchers = []
    // Remove sections of the string which describe Objects
    if (objMatch != null) {
        mutableToken = mutableToken.replace(objRegExp, '')
        matchers.push(...objMatch[0].replace(/\s*/g, '').split(/,(?=\{)/g))
    }
    // Remove sections of the string which describe Arrays
    if (arrayMatch != null) {
        mutableToken = mutableToken.replace(arrayRegExp, '')
        matchers.push(...arrayMatch[0].replace(/\s*/g, '').split(/,(?=\[)/g))
    }
    // Retrieve matchers from the `token` String which do not describe Objects or Arrays.
    const otherMatchers = mutableToken.split(',').map(str => str.trim()).filter(Boolean)
    matchers.push(...otherMatchers)
    return matchers
}

module.exports = {
    objRegExp,
    arrayRegExp,
    formatMatcher,
    formatArg,
    getMatchers
}
