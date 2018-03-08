const { EOL: newLine } = require('os')
const parseFunction = require('parse-function')().parse
const json5 = require('json5')

// type reflectedArg = {
//   argName: String
//   default?: Any?
// }

// type rule = {
//   expression: Function
//   allReflectedArgs: [ reflectedArg ]
// }

/**
 * @param {...Array<Any>} values
 * @returns {Function (...Array<Function>) -> Any?}
 */
module.exports = function wavematch (...values) {
  // for accumulating error stack traces
  let errors = []

  if (values.length === 0) {
    collectError(errors, SyntaxError('Please supply at least one argument to '
      + 'match function. Cannot match no input.'))
  }

  return function (...patterns) {
    if (patterns.length === 0) {
      // fatal error
      throw SyntaxError('Non-exhaustive patterns. ' +
        'Please at least provide the catch-all pattern "_ => { expression }".')
    }

    const rules = patterns.map((pattern, index) => {
      const isFunction = !isType('Function', pattern)
      if (isFunction) {
        collectError(errors, TypeError(`Pattern at index ${index} is not a `
          + `Function, instead is: ${getType(pattern)}.`))
      }
      let reflectedArgs = reflectArguments(pattern)

      if (reflectedArgs.length === 0) {
        collectError(errors, SyntaxError(`Pattern at index ${index} does `
          + 'accept any arguments. Expected arity of at least one.'))
      }

      if (reflectedArgs.length === 0) {
        const patternDisplayName = pattern.name === 'anonymous'
          ? 'Anonymous pattern'
          : `Pattern "${pattern.name}"`
        collectError(errors, SyntaxError(`${patternDisplayName} at index `
          + `${index} must accept one or more arguments.`))
      }

      const rule = {
        allReflectedArgs: reflectedArgs, 
        expression: pattern,
        arity: reflectedArgs.length
      }
      return rule
    })

    // search for index of catch-all rule instead of assuming it was placed
    // in the preferred location (at the last index) and provide error if not
    const indexOfCatchAllRule = rules.findIndex(rule => {
      return rule.allReflectedArgs.some(reflectedArg => {
        if (!reflectedArg.argName.includes('_')) {
          return false
        }
        const nameLength = reflectedArg.argName.length
        if (nameLength > 1) {
          collectError(errors, SyntaxError('Catch-all argument name contains '
            + `${nameLength} underscore characters. Expected just one.`))
        }
        const isCatchAllRule = reflectedArg.argName === '_'
        if (rule.arity > 1 && isCatchAllRule) {
          collectError(errors, SyntaxError('Catch-all pattern must be unary. '
            + `Expected one argument (named "_"). Found ${rule.arity} args.`))
        }
        return isCatchAllRule
      })
    })
    const catchAllExists = indexOfCatchAllRule > -1

    if (catchAllExists) {
      if (patterns.length >= 1 && indexOfCatchAllRule !== rules.length - 1) {
        collectError(errors, SyntaxError('Catch-all pattern should be the '
          + `last pattern. Instead is at index ${indexOfCatchAllRule}.`))
      }
      const catchAllRule = rules[indexOfCatchAllRule]

      if ('default' in catchAllRule) {
        collectError(errors, SyntaxError('Catch-all pattern must not have a '
          + 'default argument. Found default argument of: '
          + catchAllRule.default)
        )
      }
    } else {
      collectError(errors, SyntaxError('Non-exaustive pattern. Expected '
        + 'catch-all rule: "_ => { expression }" as last rule.'))
    } 

    // todo
    // if (rules.length === 1) {

    // }

    // throw all collected errors and clear the array
    maybeThrowAndFlushErrors(errors)

    for (let index = 0; index < rules.length; index++) {
      const rule = rules[index]

      // skip catch-all pattern as it:
      // 1) might not exist
      // 2) might not be at the last index like it's supposed to be
      if (index !== indexOfCatchAllRule) {
        if (rule.arity === values.length) {
          const matched = rule.expression(...values)
          console.log(matched)
          return matched
        }
      }
    }

    if (catchAllExists) {
      const matched = rules[indexOfCatchAllRule].expression(...values)
      console.log(matched)
      return matched
    }
  } 
}


/**
 * @param {Function} fn
 * @returns {Array<PatternArg>}
 */
function reflectArguments (fn) {
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
function isType (constructor, value) {
  return getType(value) === `[object ${constructor}]`
}


/**
 * @param {Any} value
 * @returns {String}
 */
function getType (value) {
  return Object.prototype.toString.call(value)
}


/**
 * @param {Array<Error>}
 * @param {Error}
 */
function collectError (errors, error) {
  // write this function name, file name, line number, and column number
  // to the `.stack` String prop of the supplied object
  // Error.captureStackTrace(error)
  errors.push(error.stack)
}


/**
 * @throws {Error}
 * @param {Array<Error>} errors
 */
function maybeThrowAndFlushErrors (errors) {
  const separator = [...Array(80)].map(() => '-').join('')

  if (errors.length === 1) {
    const message =
      'Aborting due to error:' + newLine + newLine
      + errors[0] + newLine + newLine
      + separator + newLine
    const singleError = Error(message)

    // flush array
    errors.length = 0

    throw singleError
  }
  else if (errors.length > 1) {
    const multiErrorStack = errors.join(newLine + newLine) + newLine
    const message =
      `Aborting due to ${errors.length} errors:` + newLine + newLine
      + multiErrorStack + newLine
      + separator + newLine
    const multiError = Error(message)

    // flush array
    errors.length = 0

    throw multiError
  }
}

// function applyExpression
