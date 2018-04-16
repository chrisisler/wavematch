// @flow

const json5: { parse: string => Object } = require('json5')
const functionParse: Function => Object = require('parse-function')().parse
const isEqual = require('lodash.isequal')

const { warning, invariant } = require('./errors.js')

type ReflectedArg = $ReadOnly<{
  argName: string,
  default?: any,
  isDestructured: boolean,
  body: string, // only used for avoiding duplicate rules
  predicate?: any => boolean // used for match guards
}>

type RuleExpression = (...Array<mixed>) => ?mixed

type Rule = $ReadOnly<{
  allReflectedArgs: Array<ReflectedArg>,
  arity: number,
  expression: RuleExpression
}>

const constructors = [
  Object,
  Number,
  Function,
  Array,
  String,
  RegExp,
  Date,
  Set,
  Map,
  Symbol,
  Proxy
]

// stand-ins for the `Object` and `Array` constructors since flow reserves the
// `Object` and `Array` keywords
type ObjectConstructor = (?mixed) => mixed | Object
type ArrayConstructor = (...Array<mixed>) => Array<mixed>

module.exports = wavematch
function wavematch(
  ...values: Array<any>
): (...Array<RuleExpression>) => ?mixed {
  invariant(
    values.length === 0,
    'Please supply at least one argument to ' +
      'match function. Cannot match on zero parameters.'
  )

  return function(...rawRules: Array<RuleExpression>) {
    invariant(
      rawRules.length === 0,
      'Non-exhaustive rules. ' +
        'Please add a rule function, or at least the wildcard rule: ' +
        '"_ => { /* expression */ }"'
    )

    let rules: Array<Rule> = rawRules.map(toRule)

    // if any rule tries to destructure an undefined value then throw
    values.forEach((value: any, valueIndex) => {
      rules.forEach((rule: Rule, ruleIndex) => {
        // skip wildcard rule and skip rules that expect fewer args than given
        if (ruleIsWildcard(rule) || valueIndex >= rule.arity) {
          return
        }

        const reflectedArg: ReflectedArg = rule.allReflectedArgs[valueIndex]

        invariant(
          reflectedArg.isDestructured === true && value === void 0,
          `Rule at index ${ruleIndex} attempts to destructure an ` +
            `undefined value at parameter index ${valueIndex}.`
        )
      })
    })

    // warn about duplicate rules and tell user which rule indexes are duped
    const duplicateRuleIndexes: Array<number> = rules
      .filter(rule => !rule.allReflectedArgs.some(args => args.isDestructured))
      .reduce((reducedIndexes, rule, index, nonDestructuredRules) => {
        const duplicateRuleIndex = nonDestructuredRules.findIndex(
          (otherRule, otherIndex) =>
            index !== otherIndex &&
            isEqual(otherRule.allReflectedArgs, rule.allReflectedArgs)
        )

        if (duplicateRuleIndex !== -1) {
          reducedIndexes.push(index)
        }

        return reducedIndexes
      }, [])

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
          `${values.length} parameters.`
      )
    }

    const indexOfWildcardRule: number = rules.findIndex((rule: Rule) =>
      rule.allReflectedArgs.some((reflectedArg: ReflectedArg, index) => {
        if (reflectedArg.isDestructured) {
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

    const wildcardExists = indexOfWildcardRule !== -1

    if (wildcardExists) {
      warning(
        rawRules.length >= 1 && indexOfWildcardRule !== rules.length - 1,
        'Wildcard pattern should be the ' +
          `last pattern. Instead is at index ${indexOfWildcardRule}.`
      )

      const wildcardArg: ?ReflectedArg = rules[
        indexOfWildcardRule
      ].allReflectedArgs.find(({ argName }) => argName === '_')

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

    // remove all rules which have guards
    // rules = rules.filter(rule =>
    //   rule.allReflectedArgs.some((_, valueIndex) => {
    //     const reflectedArg = rule.allReflectedArgs[valueIndex]
    //     const pattern: any = reflectedArg.default

    //     return !(isType('Function', pattern) && !constructors.includes(pattern))
    //   })
    // )

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

function reflectArguments(
  rawRule: RuleExpression,
  ruleIndex: number
): Array<ReflectedArg> {
  type Parsed = { args: Array<string>, defaults: Object, body: string }
  const parsed: Parsed = functionParse(rawRule)

  if (parsed.args.length === 0) {
    const reflectedArguments = []
    return reflectedArguments
  }

  return parsed.args.map((argName, argIndex) => {
    const isDestructured = argName === false
    let pattern = parsed.defaults[argName]

    // if no default then don't put `default` key in the returned object
    if (pattern === void 0) {
      if (isDestructured) {
        return {
          argName: 'destructured-argument-name',
          isDestructured: isDestructured,
          body: parsed.body
        }
      }

      return {
        argName: argName,
        isDestructured: isDestructured,
        body: parsed.body
      }
    }

    // default is an Object, parse it into an actual Object type
    if (pattern.startsWith('{')) {
      try {
        pattern = json5.parse(pattern) // `pattern` must conform to json5 spec
      } catch (error) {
        invariant(
          error instanceof SyntaxError,
          `Rule at index ${ruleIndex} has argument at parameter index ` +
            `${argIndex} that has invalid JSON5.\n` +
            `Read the spec at: https://github.com/json5/json5\n` +
            `JSON5 error message is: ${error.message}\n`
        )
      }
    } else {
      try {
        pattern = eval(pattern)
      } catch (error) {
        // attempted to use an out-of-scope variable as a default/pattern
        invariant(
          error instanceof ReferenceError,
          `For pattern at parameter index ${argIndex}, cannot use out of scope variable as ` +
            `default: ${pattern}.\nTry replacing the variable with its value.`
        )
      }
    }

    // destructured argument situation
    if (isDestructured) {
      return {
        default: pattern,
        isDestructured: isDestructured,
        argName: 'destructured-argument-name',
        body: parsed.body
      }
    }

    return {
      argName: argName,
      isDestructured: isDestructured,
      default: pattern,
      body: parsed.body
    }
  })
}

function isType(constructor: string, value: any): boolean {
  return getType(value) === `[object ${constructor}]`
}

function getType(value: any): string {
  return Object.prototype.toString.call(value)
}

function toRule(rawRule: RuleExpression, ruleIndex: number): Rule {
  warning(
    !(typeof rawRule === 'function'),
    `Rule at index ${ruleIndex} is not a ` +
      `Function, instead is: ${getType(rawRule)}.`
  )

  const allReflectedArgs: Array<ReflectedArg> = reflectArguments(
    rawRule,
    ruleIndex
  )

  const rule: Rule = {
    allReflectedArgs: allReflectedArgs,
    expression: rawRule,
    arity: allReflectedArgs.length
  }

  warning(
    rule.arity === 0,
    `${
      rawRule.name === 'anonymous' || rawRule.name === ''
        ? 'Anonymous rule'
        : `Rule "${rawRule.name}"`
    } at index ${ruleIndex} must accept one or more arguments.`
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

function isFloat(value: any): boolean {
  return isType('Number', value) && value % 1 !== 0
}

function ruleIsWildcard(rule: Rule): boolean {
  return rule.allReflectedArgs.some(arg => arg.argName === '_')
}

/**
 * This is where the type-based checking happens.
 */
function doesMatch(
  rule: Rule,
  values: Array<any>,
  ruleIndex: number,
  rules: Array<Rule>
): boolean {
  return values.every((value: any, valueIndex: number) => {
    const reflectedArg: ReflectedArg = rule.allReflectedArgs[valueIndex]

    if (reflectedArg.isDestructured === true) {
      return true
    }

    if ('default' in reflectedArg) {
      const pattern: any = reflectedArg.default

      // `pattern` may be a match guard
      if (isType('Function', pattern) && !constructors.includes(pattern)) {
        let guardResult: any = pattern(value)
        // console.log('pattern is:', pattern)
        // console.log('guardResult is:', guardResult)

        invariant(
          !isType('Boolean', guardResult),
          `Rule at rule index ${ruleIndex} has a guard function at parameter ` +
            `index ${valueIndex} that does NOT return a Boolean value. ` +
            `Expected a predicate (Boolean-returning function). Found ${getType(
              guardResult
            )}.`
        )

        if (guardResult) {
          return true
        }
      }

      // eensy-teensy bit of type-coersion here (`arguments` -> array)
      // the `isArrayLike` predicate evaluates true for Strings: exclude those
      if (isArrayLike(value) && !isType('String', value)) {
        const arrayValue = isType('Array', value) ? value : Array.from(value)
        return arrayMatch(arrayValue, valueIndex, rules, ruleIndex, pattern)
      }

      // detecting Date objects requires the `new` keyword
      if (isType('Date', value)) {
        if (Date === pattern) {
          return true
        }
        // return isEqual(pattern, value)
      }

      if (isType('Object', value)) {
        return objectMatch(value, valueIndex, rules, ruleIndex, pattern)
      }

      if (isFloat(value)) {
        return isEqual(pattern, value)
      }

      if (isType('Number', value)) {
        if (Number === pattern) {
          const otherRuleMatches = rules.some(rule => {
            if (ruleIsWildcard(rule)) return false

            const reflectedArgs = rule.allReflectedArgs[valueIndex]

            if (
              'default' in reflectedArgs &&
              reflectedArgs.default != null &&
              isType('Number', reflectedArgs.default)
            ) {
              return reflectedArgs.default === value
            }
          })

          if (otherRuleMatches) {
            return false
          }
          return true
        }
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

      if (isType('String', value)) {
        if (String === pattern) {
          const otherRuleMatches = rules.some(rule => {
            if (ruleIsWildcard(rule)) return false

            const reflectedArgs = rule.allReflectedArgs[valueIndex]

            if (
              'default' in reflectedArgs &&
              reflectedArgs.default != null &&
              isType('String', reflectedArgs.default)
            ) {
              return reflectedArgs.default === value
            }
          })

          if (otherRuleMatches) {
            return false
          }
          return true
        }
        // must use `toString` to support use of `new` keyword for String
        if (pattern === value.toString()) {
          return true
        }
        // return true
      }

      if (isType('Null', value)) {
        if (value === pattern) {
          return true
        }
      }

      if (isType('Undefined', value)) {
        if (value === pattern) {
          return true
        }
      }

      if (isType('RegExp', value)) {
        if (RegExp === pattern) {
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
  objectValue: Object,
  valueIndex: number,
  rules: Array<Rule>,
  ruleIndex: number,
  objectPattern: Object | ObjectConstructor
): boolean {
  let mostSpecificRuleIndexes = rules.reduce((indexes, rule, index) => {
    if (ruleIsWildcard(rule)) return indexes // skip

    const reflectedArg: ReflectedArg = rule.allReflectedArgs[valueIndex]

    if ('default' in reflectedArg) {
      if (typeof reflectedArg.default === 'object') {
        if (
          Object.keys(reflectedArg.default).length <=
          Object.keys(objectValue).length
        ) {
          indexes.push(index)
        }
      }
    }

    return indexes
  }, [])
  // console.log('mostSpecificRuleIndexes is:', mostSpecificRuleIndexes)

  // pattern matches any object: `(argN = Object) => { ... }`
  if (Object === objectPattern) {
    if (mostSpecificRuleIndexes.some(idx => idx > ruleIndex)) {
      return false
    } else {
      return true
    }
  } else if (isType('Object', objectPattern)) {
    const patternKeys = Object.keys(objectPattern)

    if (patternKeys.length === 0) {
      return isEqual(objectPattern, objectValue)
    }

    if (patternKeys.length <= Object.keys(objectValue).length) {
      if (mostSpecificRuleIndexes.includes(ruleIndex)) {
        return patternKeys.every((key: string) => {
          // todo: support constructor type checks in object value positions (json5)
          // if (constructors.includes(objectPattern[key])) {
          //   return isType(objectPattern[key].name, objectValue)
          // }
          return isEqual(objectPattern[key], objectValue[key])
        })
      }
    } else {
      // `pattern` has more keys than objectValue (do not warn)
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
    // index of a rule that is not this current rule (`rules[ruleIndex]`)
    // whose pattern/`default` destructures an array input
    const indexOfDestructuringRule = rules.findIndex(rule => {
      if (ruleIsWildcard(rule)) {
        return false
      }

      const reflectedArgs = rule.allReflectedArgs[valueIndex]

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
