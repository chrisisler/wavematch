// @flow

const json5: { parse: string => Object } = require('json5')
const functionParse: Function => Object = require('parse-function')().parse
const isEqual = require('lodash.isequal')

const { warning, invariant } = require('./errors.js')

type ReflectedArg = $ReadOnly<{
  argName: string,
  default?: any
}>

type Expression = (...Array<mixed>) => ?mixed

type Rule = $ReadOnly<{
  allReflectedArgs: Array<ReflectedArg>,
  arity: number,
  expression: Expression
}>

// stand-ins for the `Object` and `Array` constructors since flow reserves the
// `Object` and `Array` keywords
type ObjectConstructor = (?mixed) => mixed | Object
type ArrayConstructor = (...Array<mixed>) => Array<mixed>

module.exports = wavematch
function wavematch(...values: Array<any>): (...Array<Expression>) => ?mixed {
  warning(
    values.length === 0,
    'Please supply at least one argument to ' +
      'match function. Cannot match on zero parameters.'
  )

  return function(...patterns: Array<Expression>): ?mixed {
    invariant(
      patterns.length === 0,
      'Non-exhaustive patterns. ' +
        'Please add the wildcard pattern "_ => { expression }" at the last ' +
        'index.'
    )

    const rules: Array<Rule> = patterns.map(toRule)

    // provide warning for duplicate rules (tell user which index is duplicated)
    const duplicateRuleIndexes: Array<number> = rules.reduce(
      (reducedIndexes: Array<number>, rule, index) => {
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
    if (duplicateRuleIndexes.length) {
      warning(
        true,
        `Duplicate rules found at indexes ${duplicateRuleIndexes.join(' and ')}`
      )
    }

    const indexOfRuleOverArity = rules.findIndex(r => r.arity > values.length)
    if (indexOfRuleOverArity !== -1) {
      warning(
        true,
        `Rule at index ${indexOfRuleOverArity} tries to match ` +
          `${rules[indexOfRuleOverArity].arity} arguments. Expected only ` +
          `${values.length}.`
      )
    }

    const indexOfWildcardRule: number = rules.findIndex((rule: Rule) =>
      rule.allReflectedArgs.some((reflectedArg: ReflectedArg, index) => {
        // `reflectedArg.argName` is false if the argument is a
        // destructured array or destructured object
        if (reflectedArg.argName === false) {
          return false
        } else if (!reflectedArg.argName.includes('_')) {
          return false
        }

        const argNameLength: number = reflectedArg.argName.length

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

    const wildcardExists = indexOfWildcardRule > -1

    if (wildcardExists) {
      warning(
        patterns.length >= 1 && indexOfWildcardRule !== rules.length - 1,
        'Wildcard pattern should be the ' +
          `last pattern. Instead is at index ${indexOfWildcardRule}.`
      )

      const wildcardArg: ?ReflectedArg = rules[
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
    } else {
      warning(
        true,
        'Non-exhaustive pattern. Expected ' +
          'wildcard rule: "_ => { expression }" as last rule.'
      )
    }

    for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
      // skip wildcard pattern as it:
      // 1) might not exist
      // 2) might not be at the last index like it's supposed to be
      if (ruleIndex !== indexOfWildcardRule) {
        if (rules[ruleIndex].arity === values.length) {
          // const matched = rules[ruleIndex].expression(...values)
          if (doesMatch(rules[ruleIndex], values, ruleIndex, rules)) {
            return rules[ruleIndex].expression(...values)
          }
        }
      }
    }

    if (wildcardExists) {
      return rules[indexOfWildcardRule].expression()
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
function reflectArguments(fn: Function): Array<ReflectedArg> {
  const parsed: { args: Array<string>, defaults: Object } = functionParse(fn)

  if (parsed.args.length === 0) {
    return []
  }

  // `argName` is a false boolean if the argument is a
  // destructured array or destructured object
  if (parsed.args[0] === false) {
    warning(
      true,
      'Wavematch does not support destructured arguments. ' +
        'Returning empty array.'
    )
    // pretend the reflected args does not exist
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

function isType(constructor: string, value: any): boolean {
  return getType(value) === `[object ${constructor}]`
}

function getType(value: any): string {
  return Object.prototype.toString.call(value)
}

function toRule(pattern: Function, index: number): Rule {
  warning(
    !(typeof pattern === 'function'),
    `Pattern at index ${index} is not a ` +
      `Function, instead is: ${getType(pattern)}.`
  )

  const reflectedArgs: Array<ReflectedArg> = reflectArguments(pattern)

  const rule: Rule = {
    allReflectedArgs: reflectedArgs,
    expression: pattern,
    arity: reflectedArgs.length
  }

  warning(
    rule.arity === 0,
    `${
      pattern.name === 'anonymous'
        ? 'Anonymous pattern'
        : `Pattern "${pattern.name}"`
    } at index ${index} must accept one or more arguments.`
  )
  return rule
}

/**
 * Note: returns `true` for Strings
 */
function isArrayLike(value: any): boolean {
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

function isFloat(value: any): boolean {
  return isType('Number', value) && value % 1 !== 0
}

function ruleIsWildcard(rule: Rule): boolean {
  return rule.allReflectedArgs.some(arg => arg.argName === '_')
}

function doesMatch(
  rule: Rule,
  values: Array<any>,
  ruleIndex: number,
  rules: Array<Rule>
): boolean {
  return values.every((value: any, valueIndex: number) => {
    const reflectedArg: ReflectedArg = rule.allReflectedArgs[valueIndex]

    if ('default' in reflectedArg) {
      const pattern: any = reflectedArg.default

      // eensy-teensy bit of type-coersion here (`arguments` -> array)
      // the `isArrayLike` predicate evaluates true for Strings, exclude those
      const arrayMatched = isArrayLike(value) && !isType('String', value)
      if (arrayMatched) {
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

      // for `(value = Array) => { ... }` patterns
      // if (constructors.includes(pattern)) {
      //   return isType(pattern.name, value)
      // }
    }

    // todo
    // console.warn('----- `reflectedArg` does NOT have `default` -----')
    return true
  })
}

/**
 * @returns {Boolean} - true: accept rule, false: reject rule and try next
 */
function objectMatch(
  objectValue: Object,
  valueIndex: number,
  rules: Array<Rule>,
  ruleIndex: number,
  objectPattern: Object | ObjectConstructor
): boolean {
  // gets the index of the rule that has a pattern for the corresponding
  // input value (at `valueIndex`) with the highest number of keys (which
  // may exceed the number of keys that `objectValue` has)
  const mostSpecificRuleIndex =
    rules.length === 2
      ? 0
      : rules.reduce((reducedIndex: number, rule: Rule, currentRuleIndex) => {
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
        return patternKeys.every((key: string) => {
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
  arrayValue: Array<mixed>,
  valueIndex: number,
  rules: Array<Rule>,
  ruleIndex: number,
  arrayPattern: Array<mixed> | ArrayConstructor
): boolean {
  if (Array === arrayPattern) {
    const otherRuleDestructuresArray = rules.some(rule => {
      const reflectedArgs = rule.allReflectedArgs[valueIndex]
      if (ruleIsWildcard(rule)) {
        return false
      }

      if (
        'default' in reflectedArgs &&
        reflectedArgs.default != null &&
        isType('Array', reflectedArgs.default)
      ) {
        if (reflectedArgs.default.length > arrayValue.length) {
          return false // `reflArg.default` mismatches: too many elements
        }
        return true
      }
    })
    if (otherRuleDestructuresArray) {
      return false
    }
    return isType('Array', arrayValue)
  } else {
    if (arrayValue.length === 0) {
      return isEqual(arrayPattern, arrayValue)
    } else if (arrayPattern.length > arrayValue.length) {
      return false
    } else if (arrayPattern.length <= arrayValue.length) {
      const thisRuleIsOnlyDestructurer = rules.length === 2

      // pattern is `[]` but value is not
      if (arrayPattern.length === 0) {
        return false
      }

      if (thisRuleIsOnlyDestructurer) {
        return arrayPattern.every((destructuredArrayValue, index) => {
          return isEqual(destructuredArrayValue, arrayValue[index])
        })
      } else {
        return isEqual(arrayPattern, arrayValue)

        // "fit" meaning having arity closest to the arrayValue.length
        // there may be multiple rules with this quality
        // const indexesOfFitRules = rules.reduce(
        //   (reducedIndexes: Array<number>, rule: Rule, index: number) => {
        //     if (ruleIsWildcard(rule)) {
        //       return reducedIndexes
        //     }
        //     const reflectedArg: ReflectedArg = rule.allReflectedArgs[valueIndex]

        //     if (
        //       'default' in reflectedArg &&
        //       reflectedArg.default != null &&
        //       isType('Array', reflectedArg.default)
        //     ) {
        //       if (reflectedArg.default.length > reducedIndexes) {
        //         if (reflectedArg.default.length <= arrayValue.length) {
        //           reducedIndexes.push(index)
        //           // return currentIndex
        //         }
        //       }
        //     }
        //     return reducedIndexes
        //   },
        //   []
        // )

        console.log('indexesOfFitRules is:', indexesOfFitRules)

        if (indexesOfFitRules.includes(ruleIndex)) {
          // console.log('----in here ----')
          // console.log('arrayPattern is:', arrayPattern)
          // console.log('arrayValue is:', arrayValue)
          return isEqual(arrayPattern, arrayValue)
        }
      }
    }
  }
  // fallback behavior
  return false
}
