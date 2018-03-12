//     

// see stackoverflow.com/questions/46596235/flow-generic-type-for-function-expression-arrow-functions
// https://ponyfoo.com/articles/pattern-matching-in-ecmascript

const { EOL: newLine } = require('os')
const json5                              = require('json5')
const parseFunction           = require('parse-function')().parse

                               
                  
                      
  

                                           

                       
                                        
                
                        
  

// for accumulating error stack traces
let errors                = []

module.exports = function wavematch(
  ...values            
)                                   {
  if (values.length === 0) {
    collectError(
      SyntaxError(
        'Please supply at least one argument to ' +
          'match function. Cannot match on zero parameters.'
      )
    )
  }

  return function(...patterns                   )         {
    if (patterns.length === 0) {
      // fatal error
      throw SyntaxError(
        'Non-exhaustive patterns. ' +
          'Please add the wildcard pattern "_ => { expression }" at the last ' +
          'index.'
      )
    }

    const rules              = patterns.map(toRule)

    // search for index of wildcard rule instead of assuming it was placed
    // in the preferred location (at the last index) and provide error if not
    const indexOfWildcardRule         = rules.findIndex((rule      ) => {
      return rule.allReflectedArgs.some((reflectedArg              , index) => {
        // `reflectedArg.argName` is a false boolean if the argument is a
        // destructured array or destructured object
        if (reflectedArg.argName === false) {
          return false
        }

        if (!reflectedArg.argName.includes('_')) {
          return false
        }

        if (reflectedArg.argName.length > 1) {
          collectError(
            SyntaxError(
              'Wildcard argument name contains ' +
                reflectedArg.argName.length +
                'underscore characters. Expected just one.'
            )
          )
        }

        const isWildcardRule = reflectedArg.argName === '_'

        if (rule.arity > 1 && isWildcardRule) {
          collectError(
            SyntaxError(
              'Wildcard pattern must be unary. ' +
                `Expected one argument (named "_"). Found ${rule.arity} args.`
            )
          )
        }

        return isWildcardRule
      })
    })

    const wildcardExists = indexOfWildcardRule > -1

    if (wildcardExists) {
      if (patterns.length >= 1 && indexOfWildcardRule !== rules.length - 1) {
        collectError(
          SyntaxError(
            'Wildcard pattern should be the ' +
              `last pattern. Instead is at index ${indexOfWildcardRule}.`
          )
        )
      }

      const wildcardRule       = rules[indexOfWildcardRule]
      const wildcardArg                = wildcardRule.allReflectedArgs.find(
        (reflectedArg              ) => reflectedArg.argName === '_'
      )

      if (wildcardArg != null) {
        if ('default' in wildcardArg && wildcardArg.default != null) {
          collectError(
            SyntaxError(
              'Wildcard pattern must not have a ' +
                'default argument. Found default argument of: ' +
                wildcardArg.default
            )
          )
        }
      }
    } else {
      collectError(
        SyntaxError(
          'Non-exaustive pattern. Expected ' +
            'wildcard rule: "_ => { expression }" as last rule.'
        )
      )
    }

    // throw all collected errors and clear the array
    maybeThrowAndFlushErrors()

    for (let index = 0; index < rules.length; index++) {
      // skip wildcard pattern as it:
      // 1) might not exist
      // 2) might not be at the last index like it's supposed to be
      if (index !== indexOfWildcardRule) {
        if (rules[index].arity === values.length) {
          // const matched = rules[index].expression(...values)
          if (doesMatch(rules[index], values)) {
            return rules[index].expression(...values)
          }
        }
      }
    }

    if (wildcardExists) {
      return rules[indexOfWildcardRule].expression(...values)
    }
  }
}

// /Users/litebox/Code/Git/wavematch/node_modules/json5/lib/json5.js:64
//             throw error;
//             ^

// SyntaxError: Expected 'a' instead of 'u' at line 1 column 16 of the JSON5 data. Still to read: "umber }"
//     at error (/Users/litebox/Code/Git/wavematch/node_modules/json5/lib/json5.js:56:25)
//     at next (/Users/litebox/Code/Git/wavematch/node_modules/json5/lib/json5.js:72:17)
//     at word (/Users/litebox/Code/Git/wavematch/node_modules/json5/lib/json5.js:389:15)
//     at value (/Users/litebox/Code/Git/wavematch/node_modules/json5/lib/json5.js:493:56)
//     at object (/Users/litebox/Code/Git/wavematch/node_modules/json5/lib/json5.js:459:35)
//     at value (/Users/litebox/Code/Git/wavematch/node_modules/json5/lib/json5.js:482:20)
//     at Object.parse (/Users/litebox/Code/Git/wavematch/node_modules/json5/lib/json5.js:508:18)
//     at parsed.args.map.argName (/Users/litebox/Code/Git/wavematch/lib/index.js:158:24)
//     at Array.map (<anonymous>)
//     at reflectArguments (/Users/litebox/Code/Git/wavematch/lib/index.js:147:42)
function reflectArguments(fn          )                      {
  const parsed                                            = parseFunction(fn)

  if (parsed.args.length === 0) {
    return []
  }

  const reflectedArguments = parsed.args.map(argName => {
    // `argName` is a false boolean if the argument is a
    // destructured array or destructured object

    let _default = parsed.defaults[argName]

    // if no default then don't put `default` key in the returned object
    if (_default === void 0) {
      return {
        argName: argName
      }
    }
    // default is an Object, parse it into an actual Object type
    if (_default.startsWith('{')) {
      // pattern present in _default must be conformant to json5 spec
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

function isType(constructor        , value     )          {
  return getType(value) === `[object ${constructor}]`
}

function getType(value     )         {
  return Object.prototype.toString.call(value)
}

/**
 * accesses and mutates `errors: Array<string>` outside of this scope
 */
function collectError(error       )       {
  // write this function name, file name, line number, and column number
  // to the `.stack` String prop of the supplied object
  // Error.captureStackTrace(error)
  errors.push(error.stack)
}

/**
 * @throws {Error}
 */
function maybeThrowAndFlushErrors()       {
  const separator         = [...Array(80)].map(() => '-').join('')

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

// https://stackoverflow.com/questions/46596235/flow-generic-type-for-function-expression-arrow-functions
// wtf
// type ToRule<A, B> = <B: >(patter)
function toRule(pattern          , index        )       {
  if (!isType('Function', pattern)) {
    collectError(
      TypeError(
        `Pattern at index ${index} is not a ` +
          `Function, instead is: ${getType(pattern)}.`
      )
    )
  }

  const reflectedArgs                      = reflectArguments(pattern)

  const rule       = {
    allReflectedArgs: reflectedArgs,
    expression: pattern,
    arity: reflectedArgs.length
  }

  if (rule.arity === 0) {
    collectError(
      SyntaxError(
        `Pattern at index ${index} does ` +
          'accept any arguments. Expected arity of at least one.'
      )
    )
  }

  if (rule.allReflectedArgs.length === 0) {
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

  return rule
}

// todo
function doesMatch(rule      , values            )          {
  const constructors = [Object, Number, Function, Array, String, Set, Map]

  return values.every((value     , index        ) => {
    const reflectedArg               = rule.allReflectedArgs[index]

    if ('default' in reflectedArg) {
      const pattern      = reflectedArg.default

      // for `(value = Array) => { ... }` patterns
      if (constructors.indexOf(pattern) !== -1) {
        return isType(pattern.name, value)
      }

      // for `(value = { x: 3, y: 4 }) => { ... }` patterns
      if (isType('Object', pattern)) {
        // key value match
        const patternKeys                = Object.keys(pattern)

        if (patternKeys.length !== Object.keys(value).length) {
          return false
        }

        return patternKeys.every((key        ) => {
          if (constructors.indexOf(pattern[key]) !== -1) {
            return isType(pattern[key].name, value)
          }
          return pattern[key] === value[key]
        })
      }
    }
  })
}
