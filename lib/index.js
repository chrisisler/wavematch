//      

const json5                              = require('json5')
const functionParse                     = require('parse-function')().parse
const isEqual = require('lodash.isequal')

const { warning, invariant } = require('./errors.js')

                               
                  
                
                         
  

                                             

                       
                                        
                
                        
  

// stand-ins for the `Object` and `Array` constructors since flow reserves the
// `Object` and `Array` keywords
                                                   
                                                         

module.exports = wavematch
function wavematch(...values            )                                   {
  invariant(
    values.length === 0,
    'Please supply at least one argument to ' +
      'match function. Cannot match on zero parameters.'
  )

  return function(...patterns                   )         {
    invariant(
      patterns.length === 0,
      'Non-exhaustive patterns. ' +
        'Please add the wildcard pattern "_ => { expression }" at the last ' +
        'index.'
    )

    const rules              = patterns.map(toRule)

    // if any rule tries to destructure an undefined value then throw
    // TODO group these errors together to avoid excessive error fixing by user
    values.forEach((value     , valueIndex) => {
      rules.forEach((rule      , ruleIndex) => {
        // skip wildcard rule and skip rules that expect fewer args than given
        if (ruleIsWildcard(rule) || valueIndex >= rule.arity) {
          return
        }

        const reflectedArg               = rule.allReflectedArgs[valueIndex]
        // console.log('valueIndex is:', valueIndex)
        // console.log('rule.arity is:', rule.arity)

        invariant(
          reflectedArg.isDestructured === true && value === void 0,
          `Rule at index ${ruleIndex} attempts to destructure an ` +
            `undefined value at argument index ${valueIndex}.`
        )
      })
    })

    // provide warning for duplicate rules (tell user which index is duplicated)
    const duplicateRuleIndexes                = rules.reduce(
      (reducedIndexes               , rule, index) => {
        const duplicateRuleIndex = rules.findIndex((otherRule, otherIndex) => {
          if (index !== otherIndex) {
            return isEqual(otherRule.allReflectedArgs, rule.allReflectedArgs)
          }
        })
        if (duplicateRuleIndex !== -1) {
          reducedIndexes.push(index)
        }
        return reducedIndexes
      },
      []
    )

    warning(
      duplicateRuleIndexes.length !== 0,
      `Duplicate rules found at indexes ${duplicateRuleIndexes.join(' and ')}`
    )

    const indexOfRuleOverArity = rules.findIndex(r => r.arity > values.length)
    if (indexOfRuleOverArity !== -1) {
      warning(
        true,
        `Rule at index ${indexOfRuleOverArity} tries to match ` +
          `${rules[indexOfRuleOverArity].arity} arguments. Expected only ` +
          `${values.length}.`
      )
    }

    const indexOfWildcardRule         = rules.findIndex((rule      ) =>
      rule.allReflectedArgs.some((reflectedArg              , index) => {
        if (reflectedArg.isDestructured) {
          return false
        } else if (!reflectedArg.argName.includes('_')) {
          return false
        }

        const argNameLength         = reflectedArg.argName.length

        warning(
          reflectedArg.argName.length > 1,
          `Wildcard argument name contains ${reflectedArg.argName.length} ` +
            'underscore characters. Expected only one underscore.'
        )

        const isWildcardRule = reflectedArg.argName === '_'

        warning(
          rule.arity > 1 && isWildcardRule,
          'Wildcard pattern must be unary. ' +
            `Expected one argument (named "_"). Found ${rule.arity} args.`
        )

        return isWildcardRule
      })
    )

    const wildcardExists = indexOfWildcardRule !== -1

    warning(
      wildcardExists === false,
      'Non-exhaustive pattern. Expected ' +
        'wildcard rule: "_ => { expression }" as last rule.'
    )

    if (wildcardExists) {
      warning(
        patterns.length >= 1 && indexOfWildcardRule !== rules.length - 1,
        'Wildcard pattern should be the ' +
          `last pattern. Instead is at index ${indexOfWildcardRule}.`
      )

      const wildcardArg                = rules[
        indexOfWildcardRule
      ].allReflectedArgs.find(r => r.argName === '_')

      if (
        wildcardArg != null &&
        'default' in wildcardArg &&
        wildcardArg.default != null
      ) {
        warning(
          true,
          'Wildcard pattern must not have a ' +
            'default argument. Found default argument of: ' +
            wildcardArg.default
        )
      }
    }

    for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
      // skip wildcard pattern as it:
      // 1) might not exist
      // 2) might not be at the last index like it's supposed to be
      if (ruleIndex !== indexOfWildcardRule) {
        const rule = rules[ruleIndex]

        if (rule.arity === values.length) {
          if (doesMatch(rule, values, ruleIndex, rules)) {
            return rule.expression(...values)
          }
        }
      }
    }

    if (wildcardExists) {
      return rules[indexOfWildcardRule].expression()
    }
  }
}

function reflectArguments(fn          )                      {
  const parsed                                            = functionParse(fn)

  if (parsed.args.length === 0) {
    const reflectedArguments = []
    return reflectedArguments
  }

  return parsed.args.map((argName, index) => {
    const isDestructured = argName === false
    let pattern = parsed.defaults[argName]

    // if no default then don't put `default` key in the returned object
    if (pattern === void 0) {
      if (isDestructured) {
        return {
          argName: 'destructured-argument-name',
          isDestructured: isDestructured
        }
      }

      return {
        argName: argName,
        isDestructured: isDestructured
      }
    }

    // default is an Object, parse it into an actual Object type
    if (pattern.startsWith('{')) {
      // NOTE: pattern must be conformant to json5 spec
      pattern = json5.parse(pattern)
    } else {
      try {
        pattern = eval(pattern)
      } catch (error) {
        // attempted to use an out-of-scope variable as a default/pattern
        invariant(
          error instanceof ReferenceError,
          `For rule at index ${index}, cannot use out of scope variable as ` +
            `default: ${pattern}.\nTry replacing the variable with its value.`
        )
      }
    }

    // destructured argument situation
    if (isDestructured) {
      return {
        default: pattern,
        isDestructured: isDestructured,
        argName: 'destructured-argument-name'
      }
    }

    return {
      argName: argName,
      isDestructured: isDestructured,
      default: pattern
    }
  })
}

function isType(constructor        , value     )          {
  return getType(value) === `[object ${constructor}]`
}

function getType(value     )         {
  return Object.prototype.toString.call(value)
}

function toRule(pattern          , index        )       {
  warning(
    !(typeof pattern === 'function'),
    `Pattern at index ${index} is not a ` +
      `Function, instead is: ${getType(pattern)}.`
  )

  const reflectedArgs                      = reflectArguments(pattern)

  const rule       = {
    allReflectedArgs: reflectedArgs,
    expression: pattern,
    arity: reflectedArgs.length
  }

  warning(
    rule.arity === 0,
    `${
      pattern.name === 'anonymous' || pattern.name === ''
        ? 'Anonymous pattern'
        : `Pattern "${pattern.name}"`
    } at index ${index} must accept one or more arguments.`
  )

  return rule
}

/**
 * Note: returns `true` for Strings
 */
function isArrayLike(value     )          {
  return (
    value != null &&
    !isType('Function', value) &&
    !isType('GeneratorFunction', value) &&
    isType('Number', value.length) &&
    value.length > -1 &&
    value.length % 1 === 0 &&
    value.length <= Number.MAX_SAFE_INTEGER
  )
}

const constructors = [Object, Number, Function, Array, String, Set, Map]

function isFloat(value     )          {
  return isType('Number', value) && value % 1 !== 0
}

function ruleIsWildcard(rule      )          {
  return rule.allReflectedArgs.some(arg => arg.argName === '_')
}

function doesMatch(
  rule      ,
  values            ,
  ruleIndex        ,
  rules             
)          {
  return values.every((value     , valueIndex        ) => {
    const reflectedArg               = rule.allReflectedArgs[valueIndex]

    // TODO: This should stop the obnoxious console.warn about a missing `default`
    if (reflectedArg.isDestructured === true) {
      return true
    }

    if ('default' in reflectedArg) {
      const pattern      = reflectedArg.default

      // eensy-teensy bit of type-coersion here (`arguments` -> array)
      // the `isArrayLike` predicate evaluates true for Strings, exclude those
      if (isArrayLike(value) && !isType('String', value)) {
        const arrayValue = isType('Array', value) ? value : Array.from(value)
        return arrayMatch(arrayValue, valueIndex, rules, ruleIndex, pattern)
      }

      if (isType('Object', value)) {
        return objectMatch(value, valueIndex, rules, ruleIndex, pattern)
      }

      if (isFloat(value)) {
        return isEqual(pattern, value)
      }

      if (isType('Number', value)) {
        // whole numbers (includes 3, excludes 3.0)
        return value === pattern
      }

      if (isType('Function', value) || isType('GeneratorFunction', value)) {
        if (Function === pattern) {
          return true
        }
      }

      if (isType('Boolean', value)) {
        if (Boolean === pattern) {
          return true
        }

        if (pattern === value) {
          return true
        }
      }

      // `[].every(() => {})` evaluates to `true` for some reason... wtf js
      return false
    }

    return true
  })
}

/**
 * @returns {Boolean} - true: accept rule, false: reject rule and try next
 */
function objectMatch(
  objectValue        ,
  valueIndex        ,
  rules             ,
  ruleIndex        ,
  objectPattern                            
)          {
  // gets the index of the rule that has a pattern for the corresponding
  // input value (at `valueIndex`) with the highest number of keys (which
  // may exceed the number of keys that `objectValue` has)
  const mostSpecificRuleIndex =
    rules.length === 2
      ? 0
      : rules.reduce((reducedIndex        , rule      , currentRuleIndex) => {
          // skip the wildcard rule
          if (ruleIsWildcard(rule)) {
            return reducedIndex
          }
          const reflectedArg = rule.allReflectedArgs[valueIndex]

          if ('default' in reflectedArg) {
            if (typeof reflectedArg.default === 'object') {
              if (Object.keys(reflectedArg.default).length > reducedIndex) {
                return currentRuleIndex
              }
            }
          }

          return reducedIndex
        }, -1)

  // pattern matches any object: `(argN = Object) => { ... }`
  if (Object === objectPattern) {
    // show warning and skip constructor check if a rule with an `Object`
    // constructor type check is provided before a rule with a destructured
    // object pattern with the highest specificity (number of keys)
    // example (this _will_ trigger a warning):
    //   wavematch({ x: 1, y: 2 })(
    //     (obj = Object) => foo,
    //     (obj = { x: 1, y: 2 }) => bar,
    //     _ => baz
    //   )
    if (mostSpecificRuleIndex > ruleIndex) {
      // todo: this should warn/error
      // warning(
      //   true,
      //   `Rule at index ${ruleIndex} uses \`Object\` constructor function (at parameter ` +
      //     `index ${valueIndex}) to type check. This rule should preceed any ` +
      //     'rules that destructure objects (due to increased specificity)'
      // )
      return false
    } else {
      return true
    }
  } else if (isType('Object', objectPattern)) {
    const patternKeys = Object.keys(objectPattern)

    if (patternKeys.length === 0) {
      return isEqual(objectPattern, objectValue)
    } else if (patternKeys.length <= Object.keys(objectValue).length) {
      if (mostSpecificRuleIndex === ruleIndex) {
        return patternKeys.every((key        ) => {
          // todo: support constructor type checks in object value positions (json5)
          // if (constructors.includes(objectPattern[key])) {
          //   return isType(objectPattern[key].name, objectValue)
          // }
          return isEqual(objectPattern[key], objectValue[key])
        })
      }
    } else {
      // pattern has more keys than objectValue (do not warn)
      return false
    }
  }

  return false
}

function arrayMatch(
  arrayValue              ,
  valueIndex        ,
  rules             ,
  ruleIndex        ,
  arrayPattern                                 
)          {
  if (Array === arrayPattern) {
    // index of a rule that is not this current rule (`rules[ruleIndex]`)
    // whose pattern/`.default` destructures an array input
    const indexOfDestructuringRule = rules.findIndex(rule => {
      const reflectedArgs = rule.allReflectedArgs[valueIndex]

      if (ruleIsWildcard(rule)) {
        return false
      }

      if (
        'default' in reflectedArgs &&
        reflectedArgs.default != null &&
        isType('Array', reflectedArgs.default)
      ) {
        // `reflArg.default` mismatches: too many elements
        return reflectedArgs.default.length <= arrayValue.length
      }
    })

    if (indexOfDestructuringRule !== -1) {
      return indexOfDestructuringRule < ruleIndex
    }

    return isType('Array', arrayValue)
  }

  if (arrayValue.length === 0) {
    return isEqual(arrayPattern, arrayValue)
  } else if (arrayPattern.length > arrayValue.length) {
    return false
  } else if (arrayPattern.length <= arrayValue.length) {
    // pattern is `[]` but value is not
    if (arrayPattern.length === 0) {
      return false
    }

    const thisRuleIsOnlyDestructurer = rules.length === 2

    if (thisRuleIsOnlyDestructurer) {
      return arrayPattern.every((destructuredArrayValue, index) => {
        return isEqual(destructuredArrayValue, arrayValue[index])
      })
    }

    return isEqual(arrayPattern, arrayValue)
  }

  // fallback behavior
  return false
}
