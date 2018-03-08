//     

const { EOL: newLine } = require('os')
const parseFunction = require('parse-function')().parse
const json5 = require('json5')

                     
                  
                
 

             
                                        
                
                      
 

// for accumulating error stack traces
let errors                = []

module.exports = function wavematch(...values            )           {
  if (values.length === 0) {
    collectError(
      SyntaxError(
        'Please supply at least one argument to ' +
          'match function. Cannot match no input.'
      )
    )
  }

  return function(...patterns                 ) {
    if (patterns.length === 0) {
      // fatal error
      throw SyntaxError(
        'Non-exhaustive patterns. ' +
          'Please add the catch-all pattern "_ => { expression }" at the last ' +
          'index.'
      )
    }

    const rules = patterns.map(toRule)

    // search for index of catch-all rule instead of assuming it was placed
    // in the preferred location (at the last index) and provide error if not
    const indexOfCatchAllRule = rules.findIndex((rule      ) => {
      for (let index = 0; index < rule.allReflectedArgs.length; index++) {
        const reflectedArg               = rule.allReflectedArgs[index]

        if (!reflectedArg.argName.includes('_')) {
          return false
        }

        if (reflectedArg.argName.length > 1) {
          collectError(
            SyntaxError(
              'Catch-all argument name contains ' +
                `${
                  reflectedArg.argName.length
                } underscore characters. Expected just one.`
            )
          )
        }

        const isCatchAllRule = reflectedArg.argName === '_'

        if (rule.arity > 1 && isCatchAllRule) {
          collectError(
            SyntaxError(
              'Catch-all pattern must be unary. ' +
                `Expected one argument (named "_"). Found ${rule.arity} args.`
            )
          )
        }

        // if (isCatchAllRule && reflectedArg.default) {
        //   indexOfCatchAllArg = index
        // }

        return isCatchAllRule
      }
    })
    const catchAllExists = indexOfCatchAllRule > -1

    if (catchAllExists) {
      if (patterns.length >= 1 && indexOfCatchAllRule !== rules.length - 1) {
        collectError(
          SyntaxError(
            'Catch-all pattern should be the ' +
              `last pattern. Instead is at index ${indexOfCatchAllRule}.`
          )
        )
      }

      const catchAllRule = rules[indexOfCatchAllRule]
      const catchAllArg                = catchAllRule.allReflectedArgs.find(
        (r              ) => r.argName === '_'
      )

      if (catchAllArg != null) {
        if ('default' in catchAllArg && catchAllArg.default != null) {
          collectError(
            SyntaxError(
              'Catch-all pattern must not have a ' +
                'default argument. Found default argument of: ' +
                catchAllArg.default
            )
          )
        }
      }
    } else {
      collectError(
        SyntaxError(
          'Non-exaustive pattern. Expected ' +
            'catch-all rule: "_ => { expression }" as last rule.'
        )
      )
    }

    // throw all collected errors and clear the array
    maybeThrowAndFlushErrors()

    if (rules.length === 1) {
      return rules[0].expression(...values)
    }

    for (let index = 0; index < rules.length; index++) {
      // skip catch-all pattern as it:
      // 1) might not exist
      // 2) might not be at the last index like it's supposed to be
      if (index !== indexOfCatchAllRule) {
        if (rules[index].arity === values.length) {
          const matched = rules[index].expression(...values)
          return matched
        }
      }
    }

    if (catchAllExists) {
      const matched = rules[indexOfCatchAllRule].expression(...values)
      return matched
    }
  }
}

/**
 * @param {Function} fn
 * @returns {Array<PatternArg>}
 */
function reflectArguments(fn) {
  const parsed = parseFunction(fn)

  if (parsed.args.length === 0) {
    return []
  }

  const reflectedArguments = parsed.args.map(argName => {
    let _default = parsed.defaults[argName]

    // if no default then don't put `default` key in the returned object
    if (_default === void 0) {
      return {
        argName: argName
      }
    }
    // default is an Object, parse it into an actual Object type
    if (_default.startsWith('{')) {
      _default = json5.parse(_default)
    } else {
      _default = eval(_default)
    }

    return {
      argName: argName,
      default: _default
    }
  })

  return reflectedArguments
}

/**
 * @param {Function} constructor
 * @param {Any} value
 * @returns {Boolean}
 */
function isType(constructor, value) {
  return getType(value) === `[object ${constructor}]`
}

/**
 * @param {Any} value
 * @returns {String}
 */
function getType(value) {
  return Object.prototype.toString.call(value)
}

/**
 * @param {Error}
 */
function collectError(error) {
  // write this function name, file name, line number, and column number
  // to the `.stack` String prop of the supplied object
  // Error.captureStackTrace(error)
  errors.push(error.stack)
}

/**
 * @throws {Error}
 */
function maybeThrowAndFlushErrors() {
  const separator = [...Array(80)].map(() => '-').join('')

  if (errors.length === 1) {
    const message =
      'Aborting due to error:' +
      newLine +
      newLine +
      errors[0] +
      newLine +
      newLine +
      separator +
      newLine
    const singleError = Error(message)

    // flush array
    errors.length = 0

    throw singleError
  } else if (errors.length > 1) {
    const multiErrorStack = errors.join(newLine + newLine) + newLine
    const message =
      `Aborting due to ${errors.length} errors:` +
      newLine +
      newLine +
      multiErrorStack +
      newLine +
      separator +
      newLine
    const multiError = Error(message)

    // flush array
    errors.length = 0

    throw multiError
  }
}

function toRule(pattern, index) {
  const isFunction = !isType('Function', pattern)
  if (isFunction) {
    collectError(
      TypeError(
        `Pattern at index ${index} is not a ` +
          `Function, instead is: ${getType(pattern)}.`
      )
    )
  }
  let reflectedArgs = reflectArguments(pattern)

  if (reflectedArgs.length === 0) {
    collectError(
      SyntaxError(
        `Pattern at index ${index} does ` +
          'accept any arguments. Expected arity of at least one.'
      )
    )
  }

  if (reflectedArgs.length === 0) {
    const patternDisplayName =
      pattern.name === 'anonymous'
        ? 'Anonymous pattern'
        : `Pattern "${pattern.name}"`
    collectError(
      SyntaxError(
        `${patternDisplayName} at index ` +
          `${index} must accept one or more arguments.`
      )
    )
  }

  const rule = {
    allReflectedArgs: reflectedArgs,
    expression: pattern,
    arity: reflectedArgs.length
  }
  return rule
}
