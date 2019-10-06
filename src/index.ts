import isEqual from 'fast-deep-equal'
import JSON5 from 'json5'
import createParser from 'parse-function'

import { invariant, warning } from './shared'

// XXX Use a flag or sum type to represent missing values as requried fields
interface ReflectedArg {
  argName: string
  isDestructured: boolean
  /**
   * The default parameter of a given Rule.
   */
  pattern?: Pattern
  /**
   * for matching custom types (like 'Person' or 'Car')
   * if this key is present then so is either `.pattern` or `.subPattern`
   */
  customTypeNames?: string[]
  /**
   * Patterns can be unions of patterns, like an OR expression:
   * wavematch(random(0, 5))(
   *   (n = 1 | 3 | 5) => 'odd!',
   *   _ => 'even!'
   * )
   * If `subPatterns` is present on the instance, then `patterns` is not.
   */
  subPatterns?: Pattern[]
}

interface SubReflectedArg {
  customTypeNames?: string[] | null
  pattern: Pattern
}

interface Rule {
  allReflectedArgs: ReflectedArg[]
  /**
   * The length of `allReflectedArgs`
   */
  arity: number
  /**
   * The body of a given rule - this is a callable function.
   */
  expression: Fn
  /**
   * the body of a given rule represented as a string
   * only used for warning about avoiding duplicate rules (I think)
   */
  body: string
}

interface ObjectType {
  [key: string]: unknown
}

type Fn = (...args: unknown[]) => unknown

/**
 * Shapes of inputs that consumers of wavematch will wire together
 * to select the conditional branch according to how the inputs fit
 * these given shapes
 */
type Pattern =
  | ObjectType
  | unknown[]
  | ((value: unknown) => boolean)
  | number
  | string
  | unknown

/**
 * XXX Replace with @typescript-eslint/parser-estree
 */
const { parse } = createParser()

const isObject = <O extends ObjectType>(arg: unknown): arg is O =>
  typeof arg === 'object' && arg !== null

/**
 * A bound version of Object#hasOwnProperty.
 * This function acts as a typeguard.
 * Throws if object is not actually a plain object.
 */
const _has = Function.call.bind(Object.prototype.hasOwnProperty) as <
  Key extends string | number | symbol,
  O extends { [K in Key]: unknown }
>(
  arg: unknown,
  key: Key,
) => arg is O

/**
 * Return `hasOwnProperty` and perform type-narrowing on the given object.
 * This function acts as a typeguard.
 */
const has = <Key extends string | number | symbol>(
  arg: unknown,
  key: Key,
): arg is { [K in Key]: unknown } => isObject(arg) && _has(arg, key)

/**
 * @param constructor Like 'Array'
 * @param arg
 */
const isType = <Type = unknown>(
  constructor: string,
  arg: unknown,
): arg is Type => getType(arg) === `[object ${constructor}]`

/**
 * Note: If `Symbol` exists then the result of Object.prototype.toString.call
 * can be modified, possibly breaking the logic used for class type checks.
 */
const getType = (arg: unknown): string => Object.prototype.toString.call(arg)

const onlyUnderscoresIdentifier = /\b_+\b/

const globalCache = new Map<string, ReturnType<Fn>>()

const errorConstructors: Function[] = [
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError,
  Error,
]

const constructors: Function[] = [
  ...errorConstructors,
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
  Proxy,
]

const ruleIsWildcard = (rule: Rule): boolean =>
  rule.allReflectedArgs.some(
    arg =>
      arg.argName === '_' &&
      !arg.isDestructured &&
      !has(arg, 'pattern') &&
      !has(arg, 'subPatterns'),
  ) && rule.arity === 1

/**
 * Note: Returns true for strings.
 */
const isArrayLike = (value: unknown): boolean =>
  value != null && // XXX
  !getType(value).includes('Function') &&
  _has(value, 'length') && // XXX - This is different!
  isType<number>('Number', value.length) &&
  value.length > -1 &&
  value.length % 1 === 0 &&
  value.length <= Number.MAX_SAFE_INTEGER

const isFloat = (value: unknown): value is number =>
  isType<number>('Number', value) && value % 1 !== 0

/**
 * Represents an unreachable state.
 * @param info Optional data or message.
 */
class Unreachable extends Error {
  public name = 'Error::Unreachable'
}

const unreachable = (info?: string): never => {
  const extra = info && `\n\nInfo: ${info}`
  throw new Unreachable(
    `Reached unreachable state! (This is not good.)${extra}`,
  )
}

/**
 * The same as `Array#every` except this function returns false when the input
 * array is empty.
 */
const every = <T = unknown>(
  values: T[],
  predicate: (value: T, index: number, values: T[]) => boolean,
): boolean => {
  const length = values == null ? 0 : values.length
  if (length === 0) {
    return false
  }
  let index = -1
  while (++index < length) {
    if (!predicate(values[index], index, values)) {
      return false
    }
  }

  return true
}

// Note: no way to tell if an argument is a rest argument (like (...args) => {})
const reflectArguments = (
  rawRule: Fn,
  ruleIndex: number,
): { allReflectedArgs: ReflectedArg[]; body: string } => {
  const parsed = parse(rawRule)

  if (parsed.args.length === 0) {
    return {
      allReflectedArgs: [],
      body: parsed.body,
    }
  }

  const allReflectedArgs = parsed.args.map((argName, argIndex) => {
    const isDestructured = argName === 'false'
    const pattern = parsed.defaults[argName]
    const reflectedArg: ReflectedArg = {
      isDestructured,
      argName: isDestructured ? '@@DESTRUCTURED' : argName,
    }

    // if no default then do not add optional keys
    if (pattern === void 0) {
      return reflectedArg
    }

    const { customTypeNames, evaulatedPattern, subPatterns } = reflectPattern(
      pattern,
      ruleIndex,
      argIndex,
    )

    const optionalProps: Pick<
      ReflectedArg,
      'customTypeNames' | 'pattern' | 'subPatterns'
    > = {}

    if (customTypeNames.length) {
      optionalProps.customTypeNames = customTypeNames
    }

    if (subPatterns.length) {
      optionalProps.subPatterns = subPatterns
    } else {
      optionalProps.pattern = evaulatedPattern
    }

    return { ...reflectedArg, optionalProps }
  })

  return {
    allReflectedArgs,
    body: parsed.body,
  }
}

const toRule = (rawRule: Fn, ruleIndex: number): Rule => {
  invariant(
    typeof rawRule !== 'function',
    `Rule at index ${ruleIndex} is not a ` +
      `function, instead is: ${getType(rawRule)}.`,
  )

  const { allReflectedArgs, body } = reflectArguments(rawRule, ruleIndex)

  const rule: Rule = {
    allReflectedArgs,
    expression: rawRule,
    body,
    arity: allReflectedArgs.length,
  }

  warning(
    rule.arity === 0,
    `${
      rawRule.name === 'anonymous' || rawRule.name === ''
        ? 'Anonymous rule'
        : `Rule "${rawRule.name}"`
    } at index ${ruleIndex} must accept one or more arguments.`,
  )

  return rule
}

const allInputsSatisfyRule = (
  rule: Rule,
  inputs: any[],
  ruleIndex: number,
  rules: Rule[],
): boolean =>
  every(inputs, (input, inputIndex) => {
    const reflectedArg: ReflectedArg = rule.allReflectedArgs[inputIndex]
    // XXX Destructured object pattern not implemented
    if (reflectedArg.isDestructured) {
      return true
    }
    // ReflectedArg type may either have `subPatterns` or `pattern` key,
    // but not both at the same time.
    if (
      has(reflectedArg, 'subPatterns') &&
      Array.isArray(reflectedArg.subPatterns)
    ) {
      return reflectedArg.subPatterns.some(subPattern => {
        const subReflectedArg = {
          pattern: subPattern,
          customTypeNames: reflectedArg.customTypeNames,
        }
        return isPatternAcceptable(
          rules,
          ruleIndex,
          inputIndex,
          input,
          subReflectedArg,
        )
      })
    }
    // This case must (hopefully) be reached
    if (has(reflectedArg, 'pattern')) {
      return isPatternAcceptable(
        rules,
        ruleIndex,
        inputIndex,
        input,
        reflectedArg,
      )
    }
    unreachable()
  })

// Note: If float ends in .0 (like 2.0) it's automatically converted to
// whole numbers when the parameter is passed to the wavematch function.
// This means we never know if someone entered Num.0 or just Num.
const ruleMatchesNumberInput = (
  numberInput: Number,
  pattern: any,
  rules: Rule[],
  inputIndex: number,
): boolean => {
  if (isFloat(numberInput)) {
    if (Number === pattern) {
      const otherRuleMatches = rules.some(rule => {
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
  objectInput: { [key: string]: unknown },
  inputIndex: number,
  rules: Rule[],
  ruleIndex: number,
  objectPattern: Object | { [key: string]: unknown },
): boolean {
  const desiredKeys = Object.keys(objectInput)
  const inputSize = desiredKeys.length

  const bestFitRules = rules.reduce<{ index: number; size: number }[]>(
    (reduced, rule, index) => {
      if (ruleIsWildcard(rule)) return reduced // skip

      const r = rule.allReflectedArgs[inputIndex]

      function pushIfValidSize(pattern: unknown): void {
        if (isPlainObject(pattern)) {
          // $FlowFixMe - `pattern` is known to be an object in this block.
          const size = Object.keys(pattern).length

          // cannot have more keys than the object we are trying to match
          if (size <= inputSize) {
            reduced.push({ size, index })
          }
        }
      }

      if (has(r, 'pattern') && isObject(r.pattern)) {
        pushIfValidSize(r.pattern)
      } else if (has(r, 'subPatterns') && Array.isArray(r.subPatterns)) {
        r.subPatterns.forEach(pushIfValidSize)
      }

      return reduced
    },
    [],
  )

  // pattern matches any object: `(arg = Object) => { ... }`
  if (Object === objectPattern) {
    return !bestFitRules.some(b => b.index > ruleIndex)
  }

  const reflectedArg = rules[ruleIndex].allReflectedArgs[inputIndex]

  const argNameMatchesProp = () =>
    desiredKeys.some((inputKey, keyIndex) => {
      const objectInputValue = objectInput[inputKey]
      const doesMatch: boolean = isPatternAcceptable(
        rules,
        ruleIndex,
        keyIndex,
        objectInputValue,
        reflectedArg,
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

        ;(objectInput as any).__SECRET_MUTATION = objectInputValue
      }

      return doesMatch
    })

  if (isObject(objectPattern)) {
    const patternKeys = Object.keys(objectPattern)

    // Matching an empty object?
    if (patternKeys.length === 0) {
      return isEqual(objectPattern, objectInput)
    }

    if (patternKeys.length <= inputSize) {
      // get obj with highest number of keys (hence the name "best fit")
      const bestFitRule = bestFitRules.sort((b1, b2) =>
        b1.size > b2.size ? -1 : 1,
      )[0]

      // retain only the rules that have the most keys
      // this may not eliminate any rules, that is okay
      const filtered = bestFitRules.filter(b => b.size >= bestFitRule.size)

      // Destructuring via arg name
      if (desiredKeys.includes(reflectedArg.argName)) {
        return argNameMatchesProp()
      } else if (filtered.some(b => b.index === ruleIndex)) {
        return every(patternKeys, (key: string) =>
          isEqual(objectPattern[key], objectInput[key]),
        )
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
  arrayInput: unknown[],
  inputIndex: number,
  rules: Rule[],
  ruleIndex: number,
  pattern: unknown,
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
        has(reflectedArgs, 'pattern') &&
        Array.isArray(reflectedArgs.pattern)
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

  if (Array.isArray(pattern)) {
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
        return every(arrayInput, (inputElement, index) =>
          isEqual(pattern[index], inputElement),
        )
      }

      return isEqual(pattern, arrayInput)
    }
  }

  // fallback behavior
  return false
}

/**
 * For instances of custom types defined using `class Foo extends Bar` syntax.
 *
 * XXX TODO - Does not handle anonymous classes!!!
 *
 * @throws {Error} If `instance` class does NOT inherit from any super class.
 * @example
 * class A {}
 * class B extends A {}
 * getParentClassName(new A()) //=> undefined
 * getParentClassName(new B()) //=> 'A'
 */
const getParentClassName = (instance: unknown): string | null => {
  if (instance == null) {
    return null
  }

  const code =
    _has(instance, 'constructor') &&
    isType<string>('String', instance.constructor) &&
    instance.constructor.toString()

  if (code === false) {
    return null
  }

  if (!code.includes('class') || !code.includes('extends')) {
    return null
  }

  const parts = code.split(/\s+/).slice(0, 4)

  invariant(
    !parts.includes('extends'),
    `Expected \`class Foo extends Bar\`. Found "${parts.join(' ')}"`,
  )

  return parts[3]
}

// for `reflectArguments` only
function reflectPattern(
  pattern: any | string, // String type, actually (until `eval`uated or `JSON.parse`d)
  ruleIndex: number, // for error messages
  argIndex: number, // for error messages
): {
  customTypeNames: string[]
  subPatterns: Pattern[]
  evaulatedPattern: Pattern
} {
  const customTypeNames = []
  const subPatterns: Pattern[] = []

  // OR pattern
  // ----------
  // wavematch(random(0, 5))(
  //   (n = 1 | 3 | 5) => 'odd!',
  //   _ => 'even!'
  // )
  // Note: `pattern` = '1 | 3 | 5'
  //   Must split then evaluate iteratively.
  if (typeof pattern === 'string' && pattern.includes('|')) {
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
          .join(' and ')}`,
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
            `${argIndex} that has invalid JSON.\n${error.message || error}\n`,
        )
      }
    } else {
      try {
        pattern = eval(pattern)
      } catch (error) {
        const word = pattern[0]
        // This `catch` block occurs when a var name is used as a pattern,
        // causing a ReferenceError.
        // The following code MAKES A DANGEROUS ASSUMPTION that the
        // names/identifiers used as patterns are not PascalCase when the
        // name/identifier is NOT a class (because class names (Car, Person,
        // Queue, etc.) represent type-matching).
        const identifierOutOfScope = error instanceof ReferenceError
        const identifierIsUpperCase = word.toUpperCase() === word
        if (identifierOutOfScope && identifierIsUpperCase) {
          // checking if the custom type actually matches is not our job here,
          // that's done in `allInputsSatisfyRule`
          customTypeNames.push(pattern)
        }

        invariant(
          identifierOutOfScope && word.toLowerCase() === word,
          `For pattern at parameter index ${argIndex}, cannot use out of ` +
            `scope variable as default: ${pattern}.\n` +
            'If possible, try replacing the variable with its value.',
        )
      }
    }
  }

  return {
    evaulatedPattern: pattern,
    subPatterns,
    customTypeNames,
  }
}

/**
 * isPlainObject(new MyClass()) //=> false
 * isPlainObject([]) //=> false
 * isPlainObject({}) //=> true
 * isPlainObject({ x: 2 }) //=> true
 * isPlainObject(Object.create(null)) //=> false
 * https://github.com/reduxjs/redux/blob/master/src/utils/isPlainObject.js
 * Only used for `isPatternAcceptable()` function in this file.
 */
function isPlainObject(obj: unknown): obj is { [key: string]: unknown } {
  if (typeof obj !== 'object' || obj === null) {
    return false
  }
  let proto = obj
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto)
  }
  return Object.getPrototypeOf(obj) === proto
}

// TODO Extract conditionals to a separate function (like Yegor256 says).
const isPatternAcceptable = (
  rules: Rule[],
  ruleIndex: number,
  inputIndex: number,
  input: unknown,
  reflectedArg: ReflectedArg | SubReflectedArg,
): boolean => {
  // The following `if` statement handles matching against user-defined data:
  // class Person {}
  // wavematch(new Person())(
  //   (x = Person) => 'awesome'
  // )
  // const hasCustomTypes =
  //   'customTypeNames' in reflectedArg &&
  //   Array.isArray(reflectedArg.customTypeNames)
  if (
    has(reflectedArg, 'customTypeNames') &&
    Array.isArray(reflectedArg.customTypeNames)
  ) {
    const inputTypeName: string | null =
      _has(input, 'constructor') &&
      _has(input.constructor, 'name') &&
      isType<string>('String', input.constructor.name) &&
      input.constructor.name

    if (inputTypeName !== null) {
      if (reflectedArg.customTypeNames.includes(inputTypeName)) {
        return true
      } else {
        reflectedArg.customTypeNames.push(inputTypeName)
      }
    }

    // sub class matching (see test/custom-type.spec.js)
    const parentClassName: string | null = getParentClassName(input)

    if (
      parentClassName !== null &&
      Array.isArray(reflectedArg.customTypeNames) &&
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
              customTypeNames.includes(inputTypeName),
          ),
        )
      // TODO: Put both superclass name and subclass name in `customTypeNames`
      if (!otherRuleMatchesUserDefinedType) {
        throw ReferenceError(
          `Out of scope variable name used as pattern: ${reflectedArg.pattern}`,
        )
      }
    }
  }

  const pattern = reflectedArg.pattern

  if (!constructors.includes(pattern)) {
    const isNativePromise = isType('Promise', pattern)
    if (isNativePromise) {
      return true
    } else if (isType('Function', pattern)) {
      // `pattern` may be a match guard
      const predicate: (value: unknown) => boolean = pattern
      const guardResult: boolean = predicate(input)

      invariant(
        !isType('Boolean', guardResult),
        `Rule at rule index ${ruleIndex} has a guard function at parameter ` +
          `index ${inputIndex} that does NOT return a Boolean value. ` +
          `Expected a predicate (Boolean-returning function). Found ${getType(
            guardResult,
          )}.`,
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
      pattern,
    )
  }

  // detecting Date objects requires the `new` keyword
  if (isType('Date', input)) {
    if (Date === pattern) {
      return true
    }
    // return isEqual(pattern, input)
  }

  // wavematch(new Person())(
  //   (prop = String) => {}
  // )
  if (
    !isPlainObject(input) &&
    has(reflectedArg, 'argName') &&
    has(input, reflectedArg.argName)
  ) {
    const destructuredProp = input[reflectedArg.argName]
    input.__SECRET_MUTATION = destructuredProp
    return isPatternAcceptable(
      rules,
      ruleIndex,
      inputIndex,
      destructuredProp,
      reflectedArg,
    )
  }

  if (isPlainObject(input)) {
    return ruleMatchesObjectInput(input, inputIndex, rules, ruleIndex, pattern)
  }

  const numberMatch: boolean = ruleMatchesNumberInput(
    input,
    pattern,
    rules,
    inputIndex,
  )
  if (numberMatch) {
    return true
  }

  if (getType(input).includes('Function')) {
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

    // XXX
    return !!errorConstructors.find(
      errCtor => errCtor === pattern && input.constructor.name == errCtor,
    )
    // we know `input` is an Error instance, but what type of error?
    // this is for handling all Error types that are not the base `Error` class
    // return Object.keys(errorConstructors).some(errorTypeName => {
    //   const errorType: Function = errorConstructors[errorTypeName];
    //   return errorType === pattern && input.constructor.name === errorTypeName;
    // });
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

const isFunction = (x: unknown): boolean => typeof x === 'function'

const asString = (x: unknown): string =>
  isFunction(x)
    ? String(x)
    : Array.isArray(x)
    ? (x.map(asString) as string) // XXX
    : JSON.stringify(x, null, 2)

export default function wavematch(...inputs: unknown[]): Function {
  invariant(
    inputs.length === 0,
    'Please supply at least one argument. Cannot match on zero parameters.',
  )

  return (...rawRules: Fn[]): ReturnType<Fn> => {
    invariant(
      rawRules.length === 0,
      'Non-exhaustive rules. ' +
        'Please add a rule function, or at least the wildcard rule: ' +
        '"_ => { /* expression */ }"',
    )

    // Caching depends on both the inputs and the rules provided.
    const key =
      JSON.stringify(inputs.map(asString), null, 2) +
      JSON.stringify(rawRules.map(String), null, 2)
    if (globalCache.has(key)) {
      return globalCache.get(key)
    }

    const rules: Rule[] = rawRules.map(toRule)

    // Invariant: Cannot destructure undefined
    inputs.forEach((input: any, inputIndex) => {
      rules.forEach((rule: Rule, ruleIndex) => {
        if (ruleIsWildcard(rule) || inputIndex >= rule.arity) {
          return
        }
        const reflectedArg: ReflectedArg = rule.allReflectedArgs[inputIndex]
        invariant(
          reflectedArg.isDestructured && input === void 0,
          `Rule at index ${ruleIndex} attempts to destructure an ` +
            `undefined value at parameter index ${inputIndex}.`,
        )
      })
    })

    const indexOfRuleOverArity = rules.findIndex(r => r.arity > inputs.length)
    if (indexOfRuleOverArity !== -1) {
      warning(
        true,
        `Rule at index ${indexOfRuleOverArity} tries to match ` +
          `${rules[indexOfRuleOverArity].arity} arguments. Expected only ` +
          `${inputs.length} parameters.`,
      )
    }

    const indexOfWildcardRule: number = rules.findIndex((rule: Rule) =>
      rule.allReflectedArgs.some((reflectedArg: ReflectedArg) => {
        if (reflectedArg.isDestructured) {
          return false
        }
        if (!reflectedArg.argName.includes('_')) {
          return false
        }
        return ruleIsWildcard(rule)
      }),
    )

    for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
      if (ruleIndex !== indexOfWildcardRule) {
        const rule = rules[ruleIndex]
        if (rule.arity === inputs.length) {
          if (allInputsSatisfyRule(rule, inputs, ruleIndex, rules)) {
            const boundInputs = inputs.map((input, index) => {
              if (has(input, '__SECRET_MUTATION')) {
                return (input as any).__SECRET_MUTATION
              }
              const { argName } = rule.allReflectedArgs[index]
              return onlyUnderscoresIdentifier.test(argName) ? void 0 : input
            })

            const computed = rule.expression(...boundInputs)
            globalCache.set(key, computed)
            return computed
          }
        }
      }
    }

    if (indexOfWildcardRule !== -1) {
      const computed = rules[indexOfWildcardRule].expression()
      globalCache.set(key, computed)
      return computed
    }

    warning(true, 'End of wavematch - unhandled state.')
  }
}

wavematch.create = (...rawRules: unknown[]) => (...inputs: unknown[]) =>
  wavematch(...inputs)(...rawRules)
