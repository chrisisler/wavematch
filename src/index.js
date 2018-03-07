const parseFunction = require('parse-function')().parse
const json5 = require('json5')

// type PatternArg = Object {
//   argName: String
//   default?: Any
// }
// type PatternArgs = Array<PatternArg>
// type PatternsArgs = Array<PatternArgs>

/** @type {(Any, Any, ..., Any) -> (Fn, Fn, ..., Fn) -> Any} */
module.exports = function wavematch (...values) {
  if (values.length === 0) {
    throw Error('Cannot match no input. At least one input must be supplied.')
  }

  return function (...patterns) {
    if (patterns.length === 0) {
      throw Error('Non-exhaustive patterns. Please at least provide a rule catch-all pattern "_".')
    }

    const patternsArgs = patterns.map((pattern, index) => {
      if (!isType('Function', pattern)) {
        throw Error(`Pattern at index ${index} is not a Function, instead is: ${getType(pattern)}.`)
      }
      const reflectedArgs = reflectArguments(pattern)

      if (reflectedArgs.length === 0) {
        const nameMaybe = (pattern.name !== 'anonymous') ? `"${pattern.name}" ` : ''
        throw Error(`Pattern ${nameMaybe}at index ${index} must accept one or more arguments.`)
      }
      return reflectedArgs
    })

    const patternsIncludesCatchAll = patternsArgs.some((patternArgs, patternIndex) => {
      const catchAll = patternArgs.find(patternArg => patternArg.argName === '_')
      const catchAllExists = Boolean(catchAll)

      if (catchAllExists) {
        const catchAllIsLast = patterns.length >= 1 && patternIndex === patterns.length - 1
        if (!catchAllIsLast) {
          throw Error(`Catch-all pattern must be last, instead is ${patternIndex}.`)
        }

        const catchAllHasNoDefault = 'default' in catchAll
        if (catchAllHasNoDefault) {
          throw Error(`Catch-all pattern must not have a default value: ${catchAll.default}`)
        }
      }
    })

    const matchedPatternArgs = patternsArgs.find(patternArgs => {
      if (values.length !== patternArgs.length) {
        return false
      }

      // What we know now:
      // - values.length === patternArgs.length
      // - syntax is valid
    })
  }
}


/**
 * type Arg = Object { argName: String, default?: Any }
 *
 * @param {Function} fn
 * @returns {Array<Arg>}
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


function isType (constructor, value) {
  return getType(value) === `[object ${constructor}]`
}


function getType (value) {
  return Object.prototype.toString.call(value)
}
