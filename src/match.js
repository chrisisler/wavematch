/**
 * @flow
 * @prettier
 */

import JSON5 from 'json5'
import isEqual from 'fast-deep-equal'
import makeFunctionParse from 'parse-function'
let functionParse = makeFunctionParse().parse

import type { RuleExpression, ReflectedArg, Rule } from './flow-types'
import { warning, invariant } from './error'
import { isFloat, isArrayLike, getType, isType, every } from './shared'

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

// Note: no way to tell if an argument is a rest argument (like (...args) => {})
function reflectArguments(
  rawRule: RuleExpression,
  ruleIndex: number
): {| allReflectedArgs: Array<ReflectedArg>, body: string |} {
  type Parsed = { args: Array<string>, defaults: Object, body: string }
  const parsed: Parsed = functionParse(rawRule)

  if (parsed.args.length === 0) {
    const reflectedArguments: Array<ReflectedArg> = []
    // $FlowFixMe - This is an actual problem. But it works fine for now.
    return reflectedArguments
  }

  const allReflectedArgs = parsed.args.map((argName, argIndex) => {
    const isDestructured = argName === false
    const pattern: string = parsed.defaults[argName]

    // DEV: `parsed.body` needs to go on the Rule instance not the ReflectedArg instance.
    const reflectedArg: ReflectedArg = {
      isDestructured: isDestructured,
      argName: isDestructured ? '@@DESTRUCTURED' : argName
    }

    // if no default then do not add optional keys
    if (pattern === void 0) {
      return reflectedArg
    }

    const { customTypeNames, evaulatedPattern, subPatterns } = reflectPattern(
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
      optionalProps.pattern = evaulatedPattern
    }

    const r: ReflectedArg = Object.assign({}, reflectedArg, optionalProps)
    return r
  })

  return {
    allReflectedArgs,
    body: parsed.body
  }
}

export function toRule(rawRule: RuleExpression, ruleIndex: number): Rule {
  invariant(
    typeof rawRule !== 'function',
    `Rule at index ${ruleIndex} is not a ` +
      `function, instead is: ${getType(rawRule)}.`
  )

  const { allReflectedArgs, body } = reflectArguments(rawRule, ruleIndex)

  const rule: Rule = {
    allReflectedArgs: allReflectedArgs,
    expression: rawRule,
    body: body,
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

export function ruleIsWildcard(rule: Rule): boolean {
  return (
    rule.allReflectedArgs.some(
      arg =>
        arg.argName === '_' &&
        !('pattern' in arg) &&
        !('subPatterns' in arg) &&
        arg.isDestructured === false
    ) && rule.arity === 1
  )
}

export function allInputsSatisfyRule(
  rule: Rule,
  inputs: Array<any>,
  ruleIndex: number,
  rules: Array<Rule>
): boolean {
  return every(inputs, (input: any, inputIndex) => {
    const reflectedArg: ReflectedArg = rule.allReflectedArgs[inputIndex]

    if (reflectedArg.isDestructured === true) {
      return true
    }

    // ReflectedArg type may either have `subPatterns` or `pattern` key,
    // but not both at the same time.
    if ('subPatterns' in reflectedArg && !('pattern' in reflectedArg)) {
      if (reflectedArg.subPatterns != null) {
        return reflectedArg.subPatterns.some(subPattern => {
          let subReflectedArg = {
            pattern: subPattern,
            customTypeNames: reflectedArg.customTypeNames
          }

          return isPatternAcceptable(
            rules,
            ruleIndex,
            inputIndex,
            input,
            subReflectedArg
          )
        })
      }
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

// Note: If float ends in .0 (like 2.0) it's automatically converted to
// whole numbers when the parameter is passed to the wavematch function.
// This means we never know if someone entered Num.0 or just Num.
function ruleMatchesNumberInput(
  numberInput: Number,
  pattern: any,
  rules: Array<Rule>,
  inputIndex: number
): boolean {
  if (isFloat(numberInput)) {
    if (Number === pattern) {
      const otherRuleMatches: boolean = rules.some(rule => {
        if (ruleIsWildcard(rule)) return false

        const reflectedArgs = rule.allReflectedArgs[inputIndex]

        if (
          'pattern' in reflectedArgs &&
          reflectedArgs.pattern != null &&
          isType('Number', reflectedArgs.pattern)
        ) {
          return reflectedArgs.pattern === numberInput
        }
      })

      if (otherRuleMatches) {
        return false
      }
      return true
    }
    return isEqual(pattern, numberInput)
  }

  if (isType('Number', numberInput)) {
    if (Number === pattern) {
      const otherRuleMatches: boolean = rules.some(rule => {
        if (ruleIsWildcard(rule)) return false

        const reflectedArgs = rule.allReflectedArgs[inputIndex]

        if (
          'pattern' in reflectedArgs &&
          reflectedArgs.pattern != null &&
          isType('Number', reflectedArgs.pattern)
        ) {
          return reflectedArgs.pattern === numberInput
        }
      })

      if (otherRuleMatches) {
        return false
      }
      return true
    }
    // whole numbers (includes 3, excludes 3.0)
    return numberInput === pattern
  }

  return false
}

// when the input value at `valueIndex` is of type Object
function ruleMatchesObjectInput(
  objectInput: Object,
  inputIndex: number,
  rules: Array<Rule>,
  ruleIndex: number,
  objectPattern: Object
): boolean {
  const desiredKeys = Object.keys(objectInput)
  const inputSize = desiredKeys.length

  type BestFitRules = Array<{| +index: number, +size: number |}> //
  let bestFitRules: BestFitRules = rules.reduce(
    (reduced: BestFitRules, rule: Rule, index: number) => {
      if (ruleIsWildcard(rule)) return reduced // skip

      const r = rule.allReflectedArgs[inputIndex]

      function pushIfValidSize(pattern) {
        if (isPlainObject(pattern)) {
          // $FlowFixMe - `pattern` is known to be an object in this block.
          const size = Object.keys(pattern).length

          // cannot have more keys than the object we are trying to match
          if (size <= inputSize) {
            reduced.push({ size, index })
          }
        }
      }

      if ('pattern' in r && typeof r.pattern === 'object') {
        pushIfValidSize(r.pattern)
      } else if ('subPatterns' in r && typeof r.subPatterns !== 'undefined') {
        r.subPatterns.forEach(pushIfValidSize)
      }

      return reduced
    },
    ([]: BestFitRules)
  )

  // pattern matches any object: `(arg = Object) => { ... }`
  if (Object === objectPattern) {
    return !bestFitRules.some(b => b.index > ruleIndex)
  }

  const reflectedArg = rules[ruleIndex].allReflectedArgs[inputIndex]

  const argNameMatchesProp = (): boolean => {
    return desiredKeys.some((inputKey: string, keyIndex) => {
      const objectInputValue = objectInput[inputKey]
      const doesMatch: boolean = isPatternAcceptable(
        rules,
        ruleIndex,
        keyIndex,
        objectInputValue,
        reflectedArg
      )

      if (doesMatch) {
        // Replace object with desired prop value (see wavematch.js):
        // We want to be able to do `objectInput = objectInputValue` but that
        // mutation will not be reflected in the calling scope.
        // See "https://stackoverflow.com/questions/518000".
        for (let key in objectInput) {
          if (Object.prototype.hasOwnProperty.call(objectInput, key)) {
            delete objectInput[key]
          }
        }

        objectInput.__SECRET_MUTATION = objectInputValue
      }

      return doesMatch
    })
  }

  if (isType('Object', objectPattern)) {
    const patternKeys = Object.keys(objectPattern)

    // Matching an empty object?
    if (patternKeys.length === 0) {
      return isEqual(objectPattern, objectInput)
    }

    if (patternKeys.length <= inputSize) {
      // get obj with highest number of keys (hence the name "best fit")
      const bestFitRule = bestFitRules.sort(
        (b1, b2) => (b1.size > b2.size ? -1 : 1)
      )[0]

      // retain only the rules that have the most keys
      // this may not eliminate any rules, that is okay
      bestFitRules = bestFitRules.filter(b => b.size >= bestFitRule.size)

      // Destructuring via arg name?
      if (desiredKeys.includes(reflectedArg.argName)) {
        return argNameMatchesProp()
      } else if (bestFitRules.some(b => b.index === ruleIndex)) {
        return every(patternKeys, (key: string) => {
          return isEqual(objectPattern[key], objectInput[key])
        })
      }
    } else {
      // `pattern` has more keys than objectInput (do not warn)
      return false
    }
  }

  // This block is where this stuff happens (if pattern is not an obj literal):
  // wavematch({ title: 'some-title' })(
  //   (title => String) => {} // Property name gets destructured.
  // )
  // TODO: Provide warning for mispelling/miscapitalization of desired prop:
  //       `const fuzzyIncludes = (needle, haystack) => {}`
  if (desiredKeys.includes(reflectedArg.argName)) {
    return argNameMatchesProp()
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
      if (pattern.length === 0) {
        return false
      }

      const thisRuleIsOnlyDestructurer = rules.length === 2
      if (thisRuleIsOnlyDestructurer) {
        return every(arrayInput, (inputElement, index) => {
          return isEqual(pattern[index], inputElement)
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
 * @throws {Error} If `instance` class does NOT inherit from any super class.
 * @example
 * class A {}
 * class B extends A {}
 * getParentClassName(new A()) //=> undefined
 * getParentClassName(new B()) //=> 'A'
 */
function getParentClassName(instance: any | void): string | void {
  if (instance == null) {
    return
  }

  const code = instance.constructor.toString()

  if (!code.includes('class') || !code.includes('extends')) {
    return
  }

  const parts = code.split(/\s+/).slice(0, 4)

  // Dev Note: This is more of an "unreachable" than an "invariant".
  invariant(
    parts[2] !== 'extends',
    `Expected \`class Foo extends Bar\`. Found "${parts.join(' ')}"`
  )

  return parts[3]
}

// for `reflectArguments` only
function reflectPattern(
  pattern: any, // String type, actually (until `eval`uated or `JSON.parse`d)
  ruleIndex: number, // for error messages
  argIndex: number // for error messages
): {|
  customTypeNames: Array<string>,
  subPatterns: Array<any>,
  evaulatedPattern: any
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
    const patterns = pattern.split(/\s*\|\s*/)

    patterns.forEach(subPattern => {
      // When this function call hits the `if (pattern.includes('|'))` case
      // again, this code will not run. In other words, this recursion happens
      // a maximum of one times, potentially zero if no pattern has sub patterns.
      const sub = reflectPattern(subPattern, ruleIndex, argIndex)
      subPatterns.push(sub.evaulatedPattern)

      // Extract all custom types from the union.
      if (sub.customTypeNames.length) {
        customTypeNames.push(...sub.customTypeNames)
      }
    })

    // https://stackoverflow.com/questions/840781
    // I don't slice() before sort() because mutating order doesn't matter here.
    const duplicates = patterns
      .sort()
      .filter((value, index, sorted) => sorted[index + 1] === value)
    if (duplicates.length > 0) {
      warning(
        true,
        `Rule at index ${ruleIndex} contains duplicate pattern(s): ${duplicates
          .map(duplicated => `\`${duplicated}\``)
          .join(' and ')}`
      )
    }
  } else {
    // pattern is a plain object, parse it into an actual Object type
    if (pattern.includes('{')) {
      try {
        // data must conform to json5 spec
        pattern = JSON5.parse(pattern)
      } catch (error) {
        invariant(
          error instanceof SyntaxError,
          `Rule at index ${ruleIndex} has argument at parameter index ` +
            `${argIndex} that has invalid JSON.\n${error.message || error}\n`
        )
      }
    } else {
      try {
        pattern = eval(pattern)
      } catch (error) {
        // This `catch` block occurs when a var name is used as a pattern,
        // causing a ReferenceError.
        // The following code MAKES A DANGEROUS ASSUMPTION that the
        // names/identifiers used as patterns are not PascalCase when the
        // name/identifier is NOT a class (because class names (Car, Person,
        // Queue, etc.) represent type-matching).
        const identifierOutOfScope = error instanceof ReferenceError
        const identifierIsUpperCase = pattern[0].toUpperCase() === pattern[0]
        if (identifierOutOfScope && identifierIsUpperCase) {
          // checking if the custom type actually matches is not our job here,
          // that's done in `allInputsSatisfyRule`
          customTypeNames.push(pattern)
        }

        invariant(
          identifierOutOfScope && pattern[0].toLowerCase() === pattern[0],
          `For pattern at parameter index ${argIndex}, cannot use out of ` +
            `scope variable as default: ${pattern}.\n` +
            `If possible, try replacing the variable with its value.`
        )
      }
    }
  }

  return {
    evaulatedPattern: pattern,
    subPatterns,
    customTypeNames
  }
}

// isPlainObject(new MyClass()) //=> false
// isPlainObject([]) //=> false
// isPlainObject({}) //=> true
// isPlainObject({ x: 2 }) //=> true
// isPlainObject(Object.create(null)) //=> false
// https://github.com/reduxjs/redux/blob/master/src/utils/isPlainObject.js
// Only used for `isPatternAcceptable()` function in this file.
export function isPlainObject(obj: mixed) {
  if (typeof obj !== 'object' || obj === null) {
    return false
  }

  let proto = obj

  while (Object.getPrototypeOf(proto) !== null) {
    // $FlowFixMe - This is just not a problem.
    proto = Object.getPrototypeOf(proto)
  }

  return Object.getPrototypeOf(obj) === proto
}

// TODO Extract conditionals to a separate function (like Yegor256 says).
function isPatternAcceptable(
  rules: Array<Rule>,
  ruleIndex: number,
  inputIndex: number,
  input: any,
  // ReflectedArg or SubReflectedArg
  reflectedArg:
    | ReflectedArg
    | {| customTypeNames?: ?Array<string>, pattern: any |}
): boolean {
  // The following `if` statement handles matching against user-defined data:
  // class Person {}
  // wavematch(new Person())(
  //   (x = Person) => 'awesome'
  // )
  const hasCustomTypes =
    'customTypeNames' in reflectedArg &&
    Array.isArray(reflectedArg.customTypeNames)
  if (hasCustomTypes) {
    const inputTypeName: ?string = input.constructor.name
    // console.log('inputTypeName is:', inputTypeName)
    // console.log(
    //   'reflectedArg.customTypeNames is:',
    //   reflectedArg.customTypeNames
    // )

    if (hasCustomTypes) {
      // $FlowFixMe - `reflectedArg.customTypeNames` is NOT undefined here
      if (reflectedArg.customTypeNames.includes(inputTypeName)) {
        return true
      } else {
        // $FlowFixMe - `reflectedArg.customTypeNames` is NOT undefined here
        reflectedArg.customTypeNames.push(inputTypeName)
      }
    }

    // sub class matching (see test/custom-type.spec.js)
    const parentClassName: ?string = getParentClassName(input)
    // console.log('parentClassName is:', parentClassName)

    if (
      parentClassName != null &&
      reflectedArg.customTypeNames != null &&
      reflectedArg.customTypeNames.includes(parentClassName)
    ) {
      return true
    } else if (
      reflectedArg.pattern != null &&
      reflectedArg.pattern.toString() !== inputTypeName
    ) {
      // If another rule has a user-defined data type that matches, don't throw
      const otherRuleMatchesUserDefinedType = rules
        .filter((_, i) => i !== ruleIndex)
        .some(rule =>
          rule.allReflectedArgs.some(
            ({ customTypeNames }) =>
              Array.isArray(customTypeNames) &&
              customTypeNames.includes(inputTypeName)
          )
        )
      // TODO: Put both superclass name and subclass name in `customTypeNames`
      if (!otherRuleMatchesUserDefinedType) {
        throw ReferenceError(
          // $FlowFixMe - `reflectedArg.pattern` is NOT undefined here
          `Out of scope variable name used as pattern: ${reflectedArg.pattern}`
        )
      }
    }
  }

  const pattern: any = reflectedArg.pattern

  if (!TYPES.includes(pattern)) {
    // Improvable: The below if statement checks for native ES6 promises,
    // not supporting userland solutions like Bluebird or Q. It would be better
    // if it check for object/function typeof and .then property instead of
    // just ES6 Promises.
    if (isType('Promise', pattern) && typeof pattern.then === 'function') {
      return true
      // Support promises?
      // return pattern.then(promised =>
      //   isPatternAcceptable(rules, ruleIndex, inputIndex, input, promised)
      // )
    } else if (isType('Function', pattern)) {
      // `pattern` may be a match guard
      const predicate: Function = pattern
      const guardResult: boolean = predicate(input)

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

  if (isPlainObject(input)) {
    return ruleMatchesObjectInput(input, inputIndex, rules, ruleIndex, pattern)
  }

  let numberMatch: boolean = ruleMatchesNumberInput(
    input,
    pattern,
    rules,
    inputIndex
  )
  if (numberMatch) {
    return true
  }

  // getType(input).includes('Function') ???
  if (
    isType('Function', input) ||
    isType('GeneratorFunction', input) ||
    isType('AsyncFunction', input)
  ) {
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
  }

  // does not work for custom errors like `class MyError extends Error {}`
  //   (besides, custom types should be handled earlier in this function)
  // `input` must be a standard built-in error type
  if (isType('Error', input)) {
    // `(arg = Error) => {}` will match an input value that is any instance
    // of standard (built-in) error type (SyntaxError, RangeError, etc.)
    if (pattern === Error) {
      return true
    }

    // we know `input` is an Error instance, but what type of error?
    // this is for handling all Error types that are not the base `Error` class
    return Object.keys(ERROR_TYPES_DICTIONARY).some(errorTypeName => {
      const errorType: Function = ERROR_TYPES_DICTIONARY[errorTypeName]
      return errorType === pattern && input.constructor.name === errorTypeName
    })
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

  return false
}
