import isEqual from 'fast-deep-equal'
import JSON5 from 'json5'
import functionParse from 'parse-function'

type GuardPattern = (value: unknown) => boolean

type Pattern =
  | string
  | number
  | Boolean
  | Function // XXX How is this possible?
  | unknown[]
  | Record<string, unknown>
  | GuardPattern

type Record<K extends string | number | symbol, T> = {
  [P in K]: T
}

interface SubReflectedArg {
  customTypeNames?: string[]
  pattern: Pattern
}

interface ReflectedArg {
  argName: string
  isDestructured: boolean
  pattern?: Pattern
  /**
   * If this field exists, then do does either `pattern` or `subPattern`.
   * XXX TODO Represent this in the type system!
   */
  customTypeNames?: string[]
  /**
   * Patterns may be unions of patterns.
   * If `subPatterns` is present on the instance, then `patterns` is not.
   * XXX TODO Represent this in the type system!
   *
   * @example
   * wavematch((x = A | B | C) => {})
   */
  subPatterns?: Pattern[]
}

interface Rule {
  allReflectedArgs: ReflectedArg[]
  arity: number
  /**
   * The callable function body of a given rule.
   */
  expression: Branch
  /**
   * The body of a given rule represented.
   */
  body: string
}
/**
 * Keeps track of warning messages which have already occurred in order to
 * prevent duplicates from being printed more than once.
 */
const alreadyWarned = new Set<String>()

const warning = (hasWarning: boolean, message: string): void => {
  if (!isProduction) {
    if (!hasWarning) return
    if (alreadyWarned.has(message)) return
    alreadyWarned.add(message)
    const output = `Warning: ${message}`
    console.warn(output)
    try {
      throw Error(output)
    } catch (theseHands) {
      // This error was thrown as a convenience so that you can use this stack
      // to find the callsite that caused this warning to fire.
    }
  }
}

const isProduction = process.env.NODE_ENV === 'production'

const invariant = (condition: boolean, message: string): void | never => {
  if (!condition) return
  if (!isProduction) {
    throw Error(`Invariant failed: ${message}`)
  }
}

/**
 * Constant regexps are more performant
 */
const onlyUnderscoresIdentifier = /\b_+\b/

/**
 * XXX Add benchmarks for caching/recursion
 */
const globalCache = new Map()

/**
 * XXX TODO Improve this placeholder implementation
 * XXX Can you pass a generator as a match guard?
 */
const isValidMatchGuard = (p: Pattern): p is GuardPattern => {
  if (isFunction(p)) {
    // XXX Make a test break this
    invariant(p.length !== 1, `Invalid function signature for match guard ${p}`)
    return true
  }
  return false
}

/**
 * This function acts as a typeguard.
 *
 * Equivalent to `typeof x === 'function'`.
 */
const isFunction = (x: unknown): x is Function => typeof x === 'function'

const toString = (x: unknown): string =>
  isFunction(x)
    ? String(x)
    : Array.isArray(x)
    ? ((x.map(toString) as unknown) as string) // XXX TODO Fix this
    : JSON.stringify(x, null, 2)

const { parse } = functionParse()

/**
 * Pass generics to this function if you wish to perform type-narrowing on
 * `value`. The generics of this function are set up so that either none or all
 * are required (can't just pass one). `Key` is expected to be the exact same
 * string value as `key`. If you do not have access to the `key` variable as a
 * literal, you can use `typeof foo` in the place of `Key`. The value type
 * parameter `V` is the desired type that you wish to assert the property
 * `value[key]` can be narrowed to.
 *
 * @example
 * has<'pattern', number>(reflectedArgs, 'pattern'))
 */
const has = <Key extends string | number | symbol, V>(
  value: unknown,
  key: Key,
): value is { [K in Key]: V } =>
  Object.prototype.hasOwnProperty.call(value, key)

/**
 * Optionally acts as a typeguard, allowing consumers of this function to
 * typecast `value` to some provided type parameter.
 */
const isType = <V>(constructor: string, value: unknown): value is V =>
  getType(value) === `[object ${constructor}]`

/**
 * Object#toString.call(`value`)
 *
 * Note: If `Symbol` exists then the result of Object.prototype.toString.call
 * can be modified, possibly breaking the logic used for class type checks.
 */
const getType = (value: unknown): string =>
  Object.prototype.toString.call(value)

/**
 * Note: Returns true for strings.
 */
function isArrayLike<T = unknown>(value: unknown): value is T[] {
  /**
   * Checking for function types (from `getType`) includes any of:
   * - "[object Function]"
   * - "[object AsyncFunction]"
   * - "[object GeneratorFunction]"
   * - "[object AsyncGeneratorFunction]"
   */
  const notAnyFunctionType = !getType(value).includes('Function')

  return (
    value != null &&
    notAnyFunctionType &&
    has<'length', number>(value, 'length') &&
    isType('Number', value.length) &&
    // @ts-ignore
    value.length > -1 &&
    // @ts-ignore
    value.length % 1 === 0 &&
    // @ts-ignore
    value.length <= Number.MAX_SAFE_INTEGER
  )
}

function isFloat(value: unknown): value is number {
  return isType<number>('Number', value) && value % 1 !== 0
}

/**
 * The same as `Array#every` except this function returns false when the input
 * array is empty.
 */
function every<V>(
  array: V[],
  predicate: (value: V, index: number, values: V[]) => boolean,
): boolean {
  const length = array.length
  let index = -1

  if (length === 0) {
    return false
  }

  while (++index < length) {
    if (!predicate(array[index], index, array)) {
      return false
    }
  }

  return true
}

const ERROR_TYPES_DICTIONARY: Record<string, Function> = {
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError,
  Error,
}

const values = <V>(obj: { [key: string]: V }): V[] =>
  Object.keys(obj).map(key => obj[key])

const nativeConstructors = [
  ...values(ERROR_TYPES_DICTIONARY),
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

// Note: no way to tell if an argument is a rest argument (like (...args) => {})
function reflectArguments(
  rawRule: Branch,
  ruleIndex: number,
): { allReflectedArgs: ReflectedArg[]; body: string } {
  const parsed = parse(rawRule)

  if (parsed.args.length === 0) {
    // const reflectedArguments: Array<ReflectedArg> = []
    // $FlowFixMe - This is an actual problem. But it works fine for now.
    // return reflectedArguments
    return {
      allReflectedArgs: [],
      body: parsed.body,
    }
  }

  // @ts-ignore
  const allReflectedArgs = parsed.args.map((argName, argIndex) => {
    // tslint:disable-next-line
    const isDestructured = (argName as any) === false
    const pattern: string = parsed.defaults[argName]
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

    type OptionalProps = Pick<
      ReflectedArg,
      'customTypeNames' | 'pattern' | 'subPatterns'
    >
    const optionalProps: OptionalProps = {}

    if (customTypeNames.length) {
      optionalProps.customTypeNames = customTypeNames
    }

    if (subPatterns.length) {
      optionalProps.subPatterns = subPatterns
    } else {
      optionalProps.pattern = evaulatedPattern
    }

    return Object.assign(reflectedArg, optionalProps)
  })

  return {
    allReflectedArgs,
    body: parsed.body,
  }
}

function toRule(rawRule: Branch, ruleIndex: number): Rule {
  invariant(
    // tslint:disable-next-line
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

function ruleIsWildcard(rule: Rule): boolean {
  return (
    rule.allReflectedArgs.some(
      arg =>
        arg.argName === '_' &&
        !('pattern' in arg) &&
        !('subPatterns' in arg) &&
        !arg.isDestructured,
    ) && rule.arity === 1
  )
}

function allInputsSatisfyRule(
  rule: Rule,
  inputs: unknown[],
  ruleIndex: number,
  rules: Rule[],
): boolean {
  return every(inputs, (input: unknown, inputIndex) => {
    const reflectedArg: ReflectedArg = rule.allReflectedArgs[inputIndex]

    if (reflectedArg.isDestructured) {
      return true
    }

    // ReflectedArg type may either have `subPatterns` or `pattern` key,
    // but not both at the same time.
    if (
      has(reflectedArg, 'subPatterns') &&
      Array.isArray(reflectedArg.subPatterns) &&
      !has(reflectedArg, 'pattern')
    ) {
      // @ts-ignore: `!has` (is the problem, and) doesn't pass it's input
      // typeguard metadata through
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

    if ('pattern' in reflectedArg) {
      return isPatternAcceptable(
        rules,
        ruleIndex,
        inputIndex,
        input,
        reflectedArg,
      )
    }

    return true
  })
}

// Note: If float ends in .0 (like 2.0) it's automatically converted to
// whole numbers when the parameter is passed to the wavematch function.
// This means we never know if someone entered Num.0 or just Num.
function ruleMatchesNumberInput(
  numberInput: unknown,
  pattern: unknown,
  rules: Rule[],
  inputIndex: number,
): boolean {
  if (isFloat(numberInput)) {
    if (Number === pattern) {
      const otherRuleMatches: boolean = rules.some(rule => {
        if (ruleIsWildcard(rule)) return false

        const reflectedArgs = rule.allReflectedArgs[inputIndex]

        if (
          has<'pattern', number>(reflectedArgs, 'pattern') &&
          isType<number>('Number', reflectedArgs.pattern)
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

  if (typeof numberInput === 'number') {
    if (Number === pattern) {
      // TODO - Refactor `otherRuleMatches` to `return !rules.some(...)`
      const otherRuleMatches: boolean = rules.some(rule => {
        if (ruleIsWildcard(rule)) return false

        const reflectedArgs = rule.allReflectedArgs[inputIndex]

        if (
          has<'pattern', number>(reflectedArgs, 'pattern') &&
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
  objectInput: Record<string, unknown>,
  inputIndex: number,
  rules: Rule[],
  ruleIndex: number,
  objectPattern: Pattern,
): boolean {
  const desiredKeys = Object.keys(objectInput)
  const desiredNumKeys = desiredKeys.length

  const bestFitRules = rules.reduce<{ index: number; size: number }[]>(
    (reduced, rule, index) => {
      if (ruleIsWildcard(rule)) return reduced // skip

      const retainPatternIfValid = (pattern: unknown): void => {
        if (isPlainObject(pattern)) {
          const numKeys = Object.keys(pattern).length

          // cannot have more keys than the object we are trying to match
          if (numKeys <= desiredNumKeys) {
            reduced.push({ size: numKeys, index })
          }
        }
      }
      const r = rule.allReflectedArgs[inputIndex]
      if ('pattern' in r && typeof r.pattern === 'object') {
        retainPatternIfValid(r.pattern)
      } else if ('subPatterns' in r && typeof r.subPatterns !== 'undefined') {
        r.subPatterns.forEach(retainPatternIfValid)
      }

      return reduced
    },
    [],
  )

  // pattern matches unknown object: `(arg = Object) => { ... }`
  if (Object === objectPattern) {
    return !bestFitRules.some(b => b.index > ruleIndex)
  }

  const reflectedArg = rules[ruleIndex].allReflectedArgs[inputIndex]

  const argNameMatchesProp = (): boolean =>
    desiredKeys.some((inputKey, keyIndex) => {
      const objectInputValue = objectInput[inputKey]
      const doesMatch = isPatternAcceptable(
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
        for (const key in objectInput) {
          if (Object.prototype.hasOwnProperty.call(objectInput, key)) {
            delete objectInput[key]
          }
        }
        objectInput.__SECRET_MUTATION = objectInputValue
      }
      return doesMatch
    })

  if (isPlainObject(objectPattern)) {
    const patternKeys = Object.keys(objectPattern)

    // Matching an empty object?
    if (patternKeys.length === 0) {
      return isEqual(objectPattern, objectInput)
    }

    if (patternKeys.length <= desiredNumKeys) {
      // get obj with highest number of keys (hence the name "best fit")
      const bestFitRule = bestFitRules.sort((b1, b2) =>
        b1.size > b2.size ? -1 : 1,
      )[0]

      // retain only the rules that have the most keys
      // this may not eliminate unknown rules, that is okay
      const filtered = bestFitRules.filter(b => b.size >= bestFitRule.size)

      // Destructuring via arg name?
      if (desiredKeys.includes(reflectedArg.argName)) {
        return argNameMatchesProp()
      } else if (filtered.some(b => b.index === ruleIndex)) {
        return every(patternKeys, key =>
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

      // `reflArg.pattern` mismatches: too many elements
      if (
        has(reflectedArgs, 'pattern') &&
        Array.isArray(reflectedArgs.pattern)
      ) {
        return reflectedArgs.pattern.length <= arrayInput.length
      }
    })

    if (indexOfDestructuringRule !== -1) {
      return indexOfDestructuringRule < ruleIndex
    }

    return Array.isArray(arrayInput)
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
 * @throws {Error} If `instance` class does NOT inherit from unknown super class.
 * @example
 * class A {}
 * class B extends A {}
 * getParentClassName(new A()) //=> undefined
 * getParentClassName(new B()) //=> 'A'
 */
function getParentClassName(instance: unknown | null): string | null {
  if (instance == null) {
    return null
  }

  // @ts-ignore: XXX
  const code = instance.constructor.toString()

  if (!code.includes('class') || !code.includes('extends')) {
    return null
  }

  // XXX TODO Handle anonymous classes
  const parts = code.split(/\s+/).slice(0, 4)

  // Dev Note: This is more of an "unreachable" than an "invariant".
  invariant(
    parts[2] !== 'extends',
    `Expected \`class Foo extends Bar\`. Found "${parts.join(' ')}"`,
  )

  return parts[3]
}

// for `reflectArguments` and `reflectPattern` only
function reflectPattern(
  pattern: string,
  ruleIndex: number, // for error messages
  argIndex: number, // for error messages
): {
  customTypeNames: string[]
  subPatterns: Pattern[]
  evaulatedPattern: Pattern
} {
  const customTypeNames: Pattern[] = []
  const subPatterns: Pattern[] = []

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

    // XXX TODO Extract the mutations present in this function to clarify
    // funcitonally what this block mutates
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
          .map((duplicated: unknown) => `\`${duplicated}\``)
          .join(' and ')}`,
      )
    }
  } else if (pattern.includes('{')) {
    try {
      // data must conform to json5 spec
      // tslint:disable-next-line
      pattern = JSON5.parse(pattern)
    } catch (error) {
      invariant(
        error instanceof SyntaxError,
        `Rule at index ${ruleIndex} has argument at parameter index ` +
          `${argIndex} that has invalid JSON.\n${error.message || error}\n`,
      )
    }
  } else {
    // pattern is a plain object, parse it into an actual Object type
    try {
      // XXX Can we long-term entirely place this with a parser?
      // tslint:disable-next-line
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

  return {
    evaulatedPattern: pattern,
    subPatterns,
    // @ts-ignore: Ensure tests work
    customTypeNames,
  }
}

// isPlainObject(new MyClass()) //=> false
// isPlainObject([]) //=> false
// isPlainObject({}) //=> true
// isPlainObject({ x: 2 }) //=> true
// isPlainObject(Object.create(null)) //=> false
// https://github.com/reduxjs/redux/blob/master/src/utils/isPlainObject.js
// Only used for `isPatternAcceptable()` function in this file.
function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null) return false
  let proto = obj
  while (Object.getPrototypeOf(proto) !== null) {
    // $FlowFixMe - This is just not a problem.
    proto = Object.getPrototypeOf(proto)
  }
  return Object.getPrototypeOf(obj) === proto
}

// TODO Extract conditionals to a separate function (like Yegor256 says).
function isPatternAcceptable(
  rules: Rule[],
  ruleIndex: number,
  inputIndex: number,
  input: unknown,
  reflectedArg: ReflectedArg | SubReflectedArg,
): boolean {
  // The following `if` statement handles matching against user-defined data:
  // class Person {}
  // wavematch(new Person())(
  //   (x = Person) => 'awesome'
  // )
  if (
    'customTypeNames' in reflectedArg &&
    Array.isArray(reflectedArg.customTypeNames)
  ) {
    // @ts-ignore: How did this ever work before??
    const inputTypeName: string = input.constructor.name

    if (reflectedArg.customTypeNames.includes(inputTypeName)) {
      return true
    } else {
      reflectedArg.customTypeNames.push(inputTypeName)
    }

    // sub class matching (see test/custom-type.spec.js)
    const parentClassName: string | null = getParentClassName(input)

    if (
      parentClassName !== null &&
      reflectedArg.customTypeNames.includes(parentClassName)
    ) {
      return true
    } else if (
      has(reflectedArg, 'pattern') &&
      // @ts-ignore: How did this not break before?
      // XXX TODO Write a test that breaks this, and, if it can't be done,
      // adjust the types to reflect that behavior
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

  if (isFunction(pattern) && !nativeConstructors.includes(pattern)) {
    const isNativePromise = isType<Promise<typeof input>>('Promise', pattern)

    if (isNativePromise) {
      return true
    } else if (isValidMatchGuard(pattern)) {
      const predicate = pattern
      const guardResult: boolean = predicate(input)

      invariant(
        !isType<boolean>('Boolean', guardResult),
        `Rule at rule index ${ruleIndex} has a guard function at parameter ` +
          `index ${inputIndex} that does NOT return a Boolean value. ` +
          `Found ${getType(guardResult)}.`,
      )

      if (guardResult) {
        return true
      }
    }
  }

  // eensy-teensy bit of type-coersion here (`arguments` -> array)
  // the `isArrayLike` predicate evaluates true for Strings: exclude those
  if (isArrayLike(input) && !isType<string>('String', input)) {
    const arrayInput = Array.isArray(input) ? input : Array.from(input)
    return ruleMatchesArrayInput(
      arrayInput,
      inputIndex,
      rules,
      ruleIndex,
      pattern,
    )
  }

  // detecting Date objects requires the `new` keyword
  if (isType<Date>('Date', input)) {
    if (Date === pattern) {
      return true
    }
    // return isEqual(pattern, input)
  }

  // wavematch(new Person())(
  //   (prop = String) => {}
  // )
  if (
    typeof input === 'object' &&
    input !== null &&
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
    // if (isType<undefined>('Undefined', pattern)) {
    //   console.error('----- XXX hopefully no tests hit this! XXX -----')
    //   process.exit(-973)
    // }
    // XXX
    // @ts-ignore
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

  if (isType<boolean>('Boolean', input)) {
    if (Boolean === pattern) {
      return true
    }

    if (pattern === input) {
      return true
    }
  }

  if (isType<string>('String', input)) {
    if (String === pattern) {
      const otherRuleMatches = rules.some(rule => {
        if (ruleIsWildcard(rule)) return false

        const reflectedArgs = rule.allReflectedArgs[inputIndex]

        if (
          has<'pattern', string>(reflectedArgs, 'pattern') &&
          isType<string>('String', reflectedArgs.pattern)
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
    // @ts-ignore: How did this work before? Can we break this? Try. Write a test.
    if (pattern === input.toString()) {
      return true
    }
  }

  // does not work for custom errors like `class MyError extends Error {}`
  //   (besides, custom types should be handled earlier in this function)
  // `input` must be a standard built-in error type
  if (isType('Error', input)) {
    // `(arg = Error) => {}` will match an input value that is unknown instance
    // of standard (built-in) error type (SyntaxError, RangeError, etc.)
    if (pattern === Error) {
      return true
    }

    // we know `input` is an Error instance, but what type of error?
    // this is for handling all Error types that are not the base `Error` class
    return Object.keys(ERROR_TYPES_DICTIONARY).some(errorTypeName => {
      const errorType: Function = ERROR_TYPES_DICTIONARY[errorTypeName]
      // @ts-ignore: input.constructor.name
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

class Unreachable extends Error {
  public name = 'UnreachableError'
}
const unreachable = (): never => {
  throw new Unreachable()
}

type Branch<Result extends unknown = unknown> = (...args: unknown[]) => Result

// type Wavematch = (
//   ...inputs: unknown[]
// ) => (...rawRules: Branch[]) => ReturnType<Branch>
// type Create = <I extends unknown, Y, F extends Branch<Y>>(
//   ...rawRules: F[]
// ) => (...inputs: I[]) => ReturnType<Branch<Y>>
type Wavematch = <I extends unknown, Y, F extends Branch<Y>>(
  ...inputs: I[]
) => (...rawRules: F[]) => ReturnType<Branch<Y>>

const wavematch: Wavematch = (...inputs) => {
  invariant(
    inputs.length === 0,
    'Please supply at least one argument. Cannot match on zero parameters.',
  )

  return (...rawRules) => {
    invariant(
      rawRules.length === 0,
      'Non-exhaustive rules. ' +
        'Please add a rule function, or at least the wildcard rule: ' +
        '"_ => { /* expression */ }"',
    )

    // Caching depends on both the inputs and the rules provided.
    const key =
      JSON.stringify(inputs.map(toString), null, 2) +
      JSON.stringify(rawRules.map(String), null, 2)
    if (globalCache.has(key)) {
      return globalCache.get(key)
    }

    const rules: Rule[] = rawRules.map(toRule)

    // Invariant: Cannot destructure undefined
    inputs.forEach((input: unknown, inputIndex) => {
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
              if (
                typeof input === 'object' &&
                input !== null &&
                // has(input, '__SECRET_MUTATION') // XXX
                '__SECRET_MUTATION' in input
              ) {
                // @ts-ignore: How did this work before
                return input.__SECRET_MUTATION
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
    unreachable()
  }
}

export default wavematch

// @ts-ignore
export const create = (...rawRules) => (...inputs) =>
  wavematch(...inputs)(...rawRules)

module.exports = wavematch
module.exports.create = create
