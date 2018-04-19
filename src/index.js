// @flow

const json5: { parse: string => Object } = require('json5')
const functionParse: Function => Object = require('parse-function')().parse
const isEqual = require('lodash.isequal')

const { warning, invariant } = require('./errors.js')

// Contains meta-information about a given rule/function's parameters and
// the provided defaults/patterns. Data of this type is created by the
// `reflectedArguments` code.
type ReflectedArg = $ReadOnly<{
  // wavematch(x)(
  //   (argName = pattern) => {}
  // )
  argName: string,

  // wavematch(person)(
  //   ({ name }) => name
  // )
  isDestructured: boolean,

  // only used for warning about avoiding duplicate rules
  body: string,

  // the default parameter of a given Rule
  // wavematch(x)(
  //   (argName = pattern) => {}
  // )
  pattern?: any,

  // for matching custom types (like 'Person' or 'Car')
  customTypeNames?: Array<string>,

  // Patterns can be unions of patterns, like an OR expression:
  // wavematch(random(0, 5))(
  //   (n = 1 | 3 | 5) => 'odd!',
  //   _ => 'even!'
  // )
  // If `subPatterns` is present on the instance, then `patterns` is not.
  subPatterns?: Array<any>
}>

type RuleExpression = (...Array<mixed>) => ?mixed

type Rule = $ReadOnly<{|
  allReflectedArgs: Array<ReflectedArg>,

  // the length of `allReflectedArgs`
  arity: number,

  // the body of a given rule - this is a callable function
  expression: RuleExpression
|}>

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

    const rules: Array<Rule> = rawRules.map(toRule)

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
        }
        if (!reflectedArg.argName.includes('_')) {
          return false
        }

        warning(
          reflectedArg.argName.length > 1,
          `Wildcard argument name contains ${reflectedArg.argName.length} ` +
            'underscore characters. Expected only one underscore.'
        )

        return reflectedArg.argName.includes('_') && rule.arity === 1
      })
    )

    for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
      // skip wildcard pattern as it:
      // 1) might not exist
      // 2) might not be at the last index like it's supposed to be
      if (ruleIndex !== indexOfWildcardRule) {
        const rule = rules[ruleIndex]

        if (rule.arity === values.length) {
          if (allValuesSatisfyRule(rule, values, ruleIndex, rules)) {
            return rule.expression(...values)
          }
        }
      }
    }

    if (indexOfWildcardRule !== -1) {
      return rules[indexOfWildcardRule].expression()
    }

    invariant(
      true,
      'Gotta throw an error - end of `wavematch` with an unhandled state!'
    )
  }
}

function reflectArguments(
  rawRule: RuleExpression,
  ruleIndex: number
): Array<ReflectedArg> {
  type Parsed = { args: Array<string>, defaults: Object, body: string }
  const parsed: Parsed = functionParse(rawRule)
  // Note: no way to tell if an argument is a rest argument (like (...args) => {})

  if (parsed.args.length === 0) {
    const reflectedArguments = []
    return reflectedArguments
  }

  return parsed.args.map((argName, argIndex) => {
    const isDestructured = argName === false
    const pattern: string = parsed.defaults[argName]

    const reflectedArg: ReflectedArg = {
      isDestructured: isDestructured,
      body: parsed.body,
      argName: isDestructured ? '@@DESTRUCTURED' : argName
    }

    // if no default then do not add optional keys
    if (pattern === void 0) {
      return reflectedArg
    }

    const { customTypeNames, reflectedPattern, subPatterns } = reflectPattern(
      pattern,
      ruleIndex,
      argIndex
    )

    let optionalProps = {}

    if (customTypeNames.length) {
      optionalProps.customTypeNames = customTypeNames
    }

    if (subPatterns.length) {
      optionalProps.subPatterns = subPatterns
    } else {
      optionalProps.pattern = reflectedPattern
    }

    const r = Object.assign({}, reflectedArg, optionalProps)
    return r
  })
}

function isType(constructor: string, value: any): boolean {
  return getType(value) === `[object ${constructor}]`
}

function getType(value: any): string {
  return Object.prototype.toString.call(value)
}

function toRule(rawRule: RuleExpression, ruleIndex: number): Rule {
  invariant(
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

const constructors = [
  Object,
  Boolean,
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

/**
 * This is where the type-based checking happens.
 */
function allValuesSatisfyRule(
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

    // ReflectedArg type cannot have both `subPatterns` and `patterns` keys
    if ('subPatterns' in reflectedArg && !('patterns' in reflectedArg)) {
      return (
        reflectedArg.subPatterns &&
        reflectedArg.subPatterns.some(subPattern => {
          let subReflectedArg = {
            pattern: subPattern,
            customTypeNames:
              reflectedArg.pattern && reflectedArg.pattern.customTypeNames
          }

          return isPatternAcceptable(
            rules,
            ruleIndex,
            valueIndex,
            value,
            subReflectedArg
          )
        })
      )
    }
    // console.log('lmao')

    if ('pattern' in reflectedArg) {
      return isPatternAcceptable(
        rules,
        ruleIndex,
        valueIndex,
        value,
        reflectedArg
      )
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
  const valueSize = Object.keys(objectValue).length

  type BestFitRules = Array<{| +index: number, +size: number |}> //
  let bestFitRules: BestFitRules = rules.reduce(
    (reduced: BestFitRules, rule: Rule, index: number) => {
      if (ruleIsWildcard(rule)) return reduced // skip

      const r = rule.allReflectedArgs[valueIndex]

      if ('pattern' in r && typeof r.pattern === 'object') {
        const size = Object.keys(r.pattern).length

        // cannot have more keys than the object we are trying to match
        if (size <= valueSize) {
          reduced.push({ size, index })
        }
      }

      return reduced
    },
    ([]: BestFitRules)
  )

  // pattern matches any object: `(arg = Object) => { ... }`
  if (Object === objectPattern) {
    return !bestFitRules.some(b => b.index > ruleIndex)
  } else if (isType('Object', objectPattern)) {
    const patternKeys = Object.keys(objectPattern)

    if (patternKeys.length === 0) {
      return isEqual(objectPattern, objectValue)
    }

    if (patternKeys.length <= valueSize) {
      // get obj with highest number of keys (that's why it's named "best fit")
      const bestFitRule = bestFitRules.sort(
        (b1, b2) => (b1.size > b2.size ? -1 : 1)
      )[0]

      // retain only the rules that have the most keys
      // this may not eliminate any rules, that is okay
      bestFitRules = bestFitRules.filter(b => b.size >= bestFitRule.size)

      if (bestFitRules.some(b => b.index === ruleIndex)) {
        return patternKeys.every((key: string) => {
          // TODO: support constructor type checks as object values (json5)
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
    // whose pattern destructures an array input
    const indexOfDestructuringRule = rules.findIndex(rule => {
      if (ruleIsWildcard(rule)) {
        return false
      }

      const reflectedArgs = rule.allReflectedArgs[valueIndex]

      if (
        'pattern' in reflectedArgs &&
        reflectedArgs.pattern != null &&
        isType('Array', reflectedArgs.pattern)
      ) {
        // `reflArg.pattern` mismatches: too many elements
        return reflectedArgs.pattern.length <= arrayValue.length
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

/**
 * For instances of custom types defined using `class Foo extends Bar` syntax.
 * @example
 *
 * class A {}
 * class B extends A {}
 * tryGetParentClassName(new B()) //=> 'A'
 * tryGetParentClassName(new A()) //=> null
 */
function tryGetParentClassName(instance: any): string | void {
  const code = instance.constructor.toString()

  if (!code.includes('class') || !code.includes('extends')) {
    return void 0
  }

  const parts = code.split(/\s+/).slice(0, 4)

  invariant(
    parts[2] !== 'extends',
    `Expected "class Foo extends Bar". Found "${parts.join(' ')}"`
  )

  const parentClassName = parts[3]
  return parentClassName
}

// for `reflectArguments` only
function reflectPattern(
  pattern: any, // String type, actually (for the most part)
  ruleIndex: number, // for error messages
  argIndex: number // for error messages
): {|
  customTypeNames: Array<string>,
  subPatterns: Array<any>,
  reflectedPattern: any
|} {
  let customTypeNames = []
  let subPatterns = []

  // pattern is a plain object, parse it into an actual Object type
  if (pattern.startsWith('{')) {
    try {
      // data must conform to json5 spec
      pattern = json5.parse(pattern)
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
    // OR pattern
    // ----------
    // wavematch(random(0, 5))(
    //   (n = 1 | 3 | 5) => 'odd!',
    //   _ => 'even!'
    // )
    // Note: `pattern` = '1 | 3 | 5'
    //   Must split then evaluate iteratively.
    if (pattern.includes('|')) {
      pattern.split(/\s*\|\s*/).forEach(subPattern => {
        // When this function call hits the `if (pattern.includes('|'))` case
        // again, this code will not run. In other words, this recursion happens
        // a maximum of one times, potentially zero if no pattern has sub patterns.
        const sub = reflectPattern(subPattern, ruleIndex, argIndex)
        subPatterns.push(sub.reflectedPattern)

        if (sub.customTypeNames.length) {
          customTypeNames.push(...sub.customTypeNames)
        }
      })
    }

    try {
      pattern = eval(pattern)
    } catch (error) {
      // NOTE: The following `if` statement and `invariant` call make assume
      //   that the variable names passed to wavematch are not PascalCase for
      //   identifiers that do not represent types.

      // if `pattern` starts with an upper case character, assume it's a
      // custom class type instance (like Person or Car)
      if (
        error instanceof ReferenceError &&
        pattern[0].toUpperCase() === pattern[0]
      ) {
        // checking if the custom type actually matches is not our job here,
        // that's done in `allValuesSatisfyRule`
        customTypeNames.push(pattern)
      }

      // attempted to use an out-of-scope variable as a pattern
      invariant(
        error instanceof ReferenceError &&
          pattern[0].toLowerCase() === pattern[0], // is valid var name
        `For pattern at parameter index ${argIndex}, cannot use out of ` +
          `scope variable as default: ${pattern}.\n` +
          `If possible, try replacing the variable with its value.`
      )
    }
  }

  return { reflectedPattern: pattern, subPatterns, customTypeNames }
}

// TODO: Add subPattern handling here.
// Extract conditionals to a separate function (like Yegor says).
// May have to attach each subPattern to a fake reflectedArg object.
function isPatternAcceptable(
  rules: Array<Rule>,
  ruleIndex: number,
  valueIndex: number,
  value: any,
  reflectedArg:
    | ReflectedArg
    | {| customTypeNames: ?Array<string>, pattern: any |}
): boolean {
  if ('customTypeNames' in reflectedArg) {
    if (
      reflectedArg.customTypeNames != null &&
      reflectedArg.customTypeNames.includes(value.constructor.name)
    ) {
      return true
    }

    // derived class matching
    const valueParentTypeName: ?string = tryGetParentClassName(value)
    if (
      valueParentTypeName &&
      reflectedArg.customTypeNames != null &&
      reflectedArg.customTypeNames.includes(valueParentTypeName)
    ) {
      return true
    }
  }
  const pattern: any = reflectedArg.pattern

  if (isType('Function', pattern) && !constructors.includes(pattern)) {
    // `pattern` may be a match guard
    const guardResult: any = pattern(value)

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

  // generic case?
  // let mightBeConstructorPattern = p => {}
  // if (isType(pattern, value) && mightBeConstructorPattern(pattern)) {

  // }

  if (isFloat(value)) {
    return isEqual(pattern, value)
  }

  if (isType('Number', value)) {
    if (Number === pattern) {
      const otherRuleMatches = rules.some(rule => {
        if (ruleIsWildcard(rule)) return false

        const reflectedArgs = rule.allReflectedArgs[valueIndex]

        if (
          'pattern' in reflectedArgs &&
          reflectedArgs.pattern != null &&
          isType('Number', reflectedArgs.pattern)
        ) {
          return reflectedArgs.pattern === value
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
          'pattern' in reflectedArgs &&
          reflectedArgs.pattern != null &&
          isType('String', reflectedArgs.pattern)
        ) {
          return reflectedArgs.pattern === value
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
