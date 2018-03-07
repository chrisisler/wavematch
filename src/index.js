const reflect = require('js-function-reflector')

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
      const reflected = reflect(pattern)

      if (reflected.args.length === 0) {
        const nameMaybe = (reflected.name !== 'anonymous') ? `"${reflected.name}" ` : ''
        throw Error(`Pattern ${nameMaybe}at index ${index} must accept one or more arguments.`)
      }
      return reflected.args.map(normalize)
    })

    // console.log('patternsArgs is:', patternsArgs)
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

function normalize (arg) {
  if (isType('Array', arg)) {
    return {
      argName: arg[0],
      default: arg[1]
    }
  }
  return {
    argName: arg
  }
}

function isType (type, value) {
  return getType(value) === `[object ${type}]`
}

function getType (value) {
  return Object.prototype.toString.call(value)
}
