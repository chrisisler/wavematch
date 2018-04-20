/**
 * @flow
 * @prettier
 */

const json5: { parse: string => Object } = require('json5')
const functionParse: Function => Object = require('parse-function')().parse
// const isEqual = require('lodash.isequal')
const isEqual = require('fast-deep-equal')

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
  //   ([ head ]) => head
  // )
  isDestructured: boolean,

  // the body of a given rule represented as a string
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
  ...inputs: Array<any>
): (...Array<RuleExpression>) => ?mixed {
  invariant(
    inputs.length === 0,
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

    // if any rule tries to destructure an undefined input value then throw
    inputs.forEach((input: any, inputIndex) => {
      rules.forEach((rule: Rule, ruleIndex) => {
        // skip wildcard rule and skip rules that expect fewer args than given
        if (ruleIsWildcard(rule) || inputIndex >= rule.arity) {
          return
        }

        const reflectedArg: ReflectedArg = rule.allReflectedArgs[inputIndex]

        invariant(
          reflectedArg.isDestructured === true && input === void 0,
          `Rule at index ${ruleIndex} attempts to destructure an ` +
            `undefined value at parameter index ${inputIndex}.`
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

    const indexOfRuleOverArity = rules.findIndex(r => r.arity > inputs.length)
    if (indexOfRuleOverArity !== -1) {
      warning(
        true,
        `Rule at index ${indexOfRuleOverArity} tries to match ` +
          `${rules[indexOfRuleOverArity].arity} arguments. Expected only ` +
          `${inputs.length} parameters.`
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

        if (rule.arity === inputs.length) {
          if (allInputsSatisfyRule(rule, inputs, ruleIndex, rules)) {
            return rule.expression(...inputs)
          }
        }
      }
    }

    if (indexOfWildcardRule !== -1) {
      return rules[indexOfWildcardRule].expression()
    }

    warning(
      true,
      'Gotta show a warning - end of `wavematch` with an unhandled state!'
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

const ERROR_TYPES_DICTIONARY = {
  EvalError: EvalError,
  RangeError: RangeError,
  ReferenceError: ReferenceError,
  SyntaxError: SyntaxError,
  TypeError: TypeError,
  URIError: URIError,
  Error: Error
}

const values = obj => Object.keys(obj).map(key => obj[key])

const TYPES: Array<Function> = [
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
].concat(values(ERROR_TYPES_DICTIONARY))

/**
 * This is where the type-based checking happens.
 */
function allInputsSatisfyRule(
  rule: Rule,
  inputs: Array<any>,
  ruleIndex: number,
  rules: Array<Rule>
): boolean {
  return inputs.every((input: any, inputIndex: number) => {
    const reflectedArg: ReflectedArg = rule.allReflectedArgs[inputIndex]

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
            inputIndex,
            input,
            subReflectedArg
          )
        })
      )
    }

    if ('pattern' in reflectedArg) {
      return isPatternAcceptable(
        rules,
        ruleIndex,
        inputIndex,
        input,
        reflectedArg
      )
    }

    return true
  })
}

// when the input value at `valueIndex` is of type Object
function ruleMatchesObjectInput(
  objectInput: Object,
  inputIndex: number,
  rules: Array<Rule>,
  ruleIndex: number,
  objectPattern: Object | ObjectConstructor
): boolean {
  const desiredKeys = Object.keys(objectInput)
  const inputSize = desiredKeys.length

  type BestFitRules = Array<{| +index: number, +size: number |}> //
  let bestFitRules: BestFitRules = rules.reduce(
    (reduced: BestFitRules, rule: Rule, index: number) => {
      if (ruleIsWildcard(rule)) return reduced // skip

      const r = rule.allReflectedArgs[inputIndex]

      function pushIfValidSize(pattern) {
        const size = Object.keys(pattern).length

        // cannot have more keys than the object we are trying to match
        if (size <= inputSize) {
          reduced.push({ size, index })
        }
      }

      if ('pattern' in r && typeof r.pattern === 'object') {
        pushIfValidSize(r.pattern)
      } else if ('subPatterns' in r && typeof r.subPatterns !== 'undefined') {
        r.subPatterns.forEach(subPattern => {
          pushIfValidSize(subPattern)
        })
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
      return isEqual(objectPattern, objectInput)
    }

    if (patternKeys.length <= inputSize) {
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
          // if (TYPES.includes(objectPattern[key])) {
          //   return isType(objectPattern[key].name, objectInput)
          // }
          return isEqual(objectPattern[key], objectInput[key])
        })
      }
    } else {
      // `pattern` has more keys than objectInput (do not warn)
      return false
    }
  }

  const reflectedArg = rules[ruleIndex].allReflectedArgs[inputIndex]

  // TODO: add forgiveness for mispelling and missed capitalization,
  //   and provide a warning for it.
  if (desiredKeys.includes(reflectedArg.argName)) {
    const anyValueSatisfiesPattern = Object.keys(objectInput).some(
      (objectInputKey, index) => {
        const objectInputValue = objectInput[objectInputKey]
        return isPatternAcceptable(
          rules,
          ruleIndex,
          index,
          objectInputValue,
          reflectedArg
        )
      }
    )
    // console.log('anyValueSatisfiesPattern is:', anyValueSatisfiesPattern)
    return anyValueSatisfiesPattern
  }

  return false
}

function ruleMatchesArrayInput(
  arrayInput: Array<mixed>,
  inputIndex: number,
  rules: Array<Rule>,
  ruleIndex: number,
  pattern: any
): boolean {
  if (Array === pattern) {
    // index of a rule that is not this current rule (`rules[ruleIndex]`)
    // whose pattern destructures an array input
    const indexOfDestructuringRule = rules.findIndex(rule => {
      if (ruleIsWildcard(rule)) {
        return false
      }

      const reflectedArgs = rule.allReflectedArgs[inputIndex]

      if (
        'pattern' in reflectedArgs &&
        reflectedArgs.pattern != null &&
        isType('Array', reflectedArgs.pattern)
      ) {
        // `reflArg.pattern` mismatches: too many elements
        return reflectedArgs.pattern.length <= arrayInput.length
      }
    })

    if (indexOfDestructuringRule !== -1) {
      return indexOfDestructuringRule < ruleIndex
    }

    return isType('Array', arrayInput)
  }

  if (isType('Array', pattern)) {
    if (arrayInput.length === 0) {
      return isEqual(pattern, arrayInput)
    } else if (pattern.length > arrayInput.length) {
      return false
    } else if (pattern.length <= arrayInput.length) {
      // pattern is `[]` but value is not
      if (pattern.length === 0) {
        return false
      }

      const thisRuleIsOnlyDestructurer = rules.length === 2

      if (thisRuleIsOnlyDestructurer) {
        if (pattern)
          return pattern.every((destructuredArrayValue, index) => {
            return isEqual(destructuredArrayValue, arrayInput[index])
          })
      }

      return isEqual(pattern, arrayInput)
    }
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
  } else {
    // pattern is a plain object, parse it into an actual Object type
    if (pattern.includes('{')) {
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
          // that's done in `allInputsSatisfyRule`
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
  }

  return { reflectedPattern: pattern, subPatterns, customTypeNames }
}

// TODO:
// Extract conditionals to a separate function (like Yegor says).
function isPatternAcceptable(
  rules: Array<Rule>,
  ruleIndex: number,
  inputIndex: number,
  input: any,
  reflectedArg:
    | ReflectedArg
    | {| customTypeNames: ?Array<string>, pattern: any |}
): boolean {
  // handle custom classes situation:
  // wavematch(new Person())(
  //   (x = Person) => 'awesome'
  // )
  if ('customTypeNames' in reflectedArg) {
    if (
      reflectedArg.customTypeNames != null &&
      reflectedArg.customTypeNames.includes(input.constructor.name)
    ) {
      return true
    }

    // derived class matching
    const inputParentTypeName: ?string = tryGetParentClassName(input)
    if (
      inputParentTypeName &&
      reflectedArg.customTypeNames != null &&
      reflectedArg.customTypeNames.includes(inputParentTypeName)
    ) {
      return true
    }
  }

  const pattern: any = reflectedArg.pattern

  if (!TYPES.includes(pattern)) {
    if (isType('Function', pattern)) {
      // `pattern` may be a match guard
      const guardResult: any = pattern(input)

      invariant(
        !isType('Boolean', guardResult),
        `Rule at rule index ${ruleIndex} has a guard function at parameter ` +
          `index ${inputIndex} that does NOT return a Boolean value. ` +
          `Expected a predicate (Boolean-returning function). Found ${getType(
            guardResult
          )}.`
      )

      if (guardResult) {
        return true
      }
    }
  }

  // eensy-teensy bit of type-coersion here (`arguments` -> array)
  // the `isArrayLike` predicate evaluates true for Strings: exclude those
  if (isArrayLike(input) && !isType('String', input)) {
    const arrayInput = isType('Array', input) ? input : Array.from(input)
    return ruleMatchesArrayInput(
      arrayInput,
      inputIndex,
      rules,
      ruleIndex,
      pattern
    )
  }

  // detecting Date objects requires the `new` keyword
  if (isType('Date', input)) {
    if (Date === pattern) {
      return true
    }
    // return isEqual(pattern, input)
  }

  if (isType('Object', input)) {
    return ruleMatchesObjectInput(input, inputIndex, rules, ruleIndex, pattern)
  }

  // generic case?
  // let mightBeConstructorPattern = p => {}
  // if (isType(pattern, input) && mightBeConstructorPattern(pattern)) {

  // }

  if (isFloat(input)) {
    return isEqual(pattern, input)
  }

  if (isType('Number', input)) {
    if (Number === pattern) {
      const otherRuleMatches = rules.some(rule => {
        if (ruleIsWildcard(rule)) return false

        const reflectedArgs = rule.allReflectedArgs[inputIndex]

        if (
          'pattern' in reflectedArgs &&
          reflectedArgs.pattern != null &&
          isType('Number', reflectedArgs.pattern)
        ) {
          return reflectedArgs.pattern === input
        }
      })

      if (otherRuleMatches) {
        return false
      }
      return true
    }
    // whole numbers (includes 3, excludes 3.0)
    return input === pattern
  }

  if (isType('Function', input) || isType('GeneratorFunction', input)) {
    if (Function === pattern) {
      return true
    }
  }

  if (isType('Boolean', input)) {
    if (Boolean === pattern) {
      return true
    }

    if (pattern === input) {
      return true
    }
  }

  if (isType('String', input)) {
    if (String === pattern) {
      const otherRuleMatches = rules.some(rule => {
        if (ruleIsWildcard(rule)) return false

        const reflectedArgs = rule.allReflectedArgs[inputIndex]

        if (
          'pattern' in reflectedArgs &&
          reflectedArgs.pattern != null &&
          isType('String', reflectedArgs.pattern)
        ) {
          return reflectedArgs.pattern === input
        }
      })

      if (otherRuleMatches) {
        return false
      }
      return true
    }
    // must use `toString` to support use of `new` keyword for String
    if (pattern === input.toString()) {
      return true
    }
    // return true
  }

  // does not work for custom errors like `class MyError extends Error {}`
  //   (besides, custom types should be handled earlier in this function)
  // `input` must be a standard built-in error type
  if (isType('Error', input)) {
    // `(arg = Error) => {}` will match an input value that is an instance
    // of standard (built-in) error type (SyntaxError, RangeError, etc.)
    if (pattern === Error) {
      return true
    }
    // we know `input` is an Error instance, but what type of error?
    // this is for handling SyntaxError, RangeError, etc. -> this handles
    // all Error types that are not the base `Error` class
    // if (input.constructor.name !== Error) {
    //   // todo
    // }

    // pattern = SyntaxError
    // input = Error()

    return Object.keys(ERROR_TYPES_DICTIONARY).some(errorTypeName => {
      const errorType: Function = ERROR_TYPES_DICTIONARY[errorTypeName]
      return errorType === pattern
    })

    // if (Object.keys(ERROR_TYPES_DICTIONARY).includes(pattern)) {
    //   return true
    // }
  }

  if (isType('Null', input)) {
    if (input === pattern) {
      return true
    }
  }

  if (isType('Undefined', input)) {
    if (input === pattern) {
      return true
    }
  }

  if (isType('RegExp', input)) {
    if (RegExp === pattern) {
      return true
    }
  }

  // `[].every(() => {})` evaluates to `true` for some reason... wtf js
  return false
}
