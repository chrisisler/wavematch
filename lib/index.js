//      

const json5                              = require('json5')
const functionParse                     = require('parse-function')().parse
const isEqual = require('lodash.isequal')

const { warning, invariant } = require('./errors.js')

// Contains meta-information about a given rule/function's parameters and
// the provided defaults/patterns. Data of this type is created by the
// `reflectedArguments` code.
                               
                  
                                
      
                  

                       
                         
      
                          

                                                         
               

                                          
                  
                                
      
                

                                                       
                                  

                                                               
                             
                                 
                   
      
                                                                         
                          
  

                                                 

                        
                                        

                                     
                

                                                           
                            
   

// stand-ins for the `Object` and `Array` constructors since flow reserves the
// `Object` and `Array` keywords
                                                   
                                                         

module.exports = wavematch
function wavematch(
  ...values            
)                                       {
  invariant(
    values.length === 0,
    'Please supply at least one argument to ' +
      'match function. Cannot match on zero parameters.'
  )

  return function(...rawRules                       ) {
    invariant(
      rawRules.length === 0,
      'Non-exhaustive rules. ' +
        'Please add a rule function, or at least the wildcard rule: ' +
        '"_ => { /* expression */ }"'
    )

    const rules              = rawRules.map(toRule)

    // if any rule tries to destructure an undefined value then throw
    values.forEach((value     , valueIndex) => {
      rules.forEach((rule      , ruleIndex) => {
        // skip wildcard rule and skip rules that expect fewer args than given
        if (ruleIsWildcard(rule) || valueIndex >= rule.arity) {
          return
        }

        const reflectedArg               = rule.allReflectedArgs[valueIndex]

        invariant(
          reflectedArg.isDestructured === true && value === void 0,
          `Rule at index ${ruleIndex} attempts to destructure an ` +
            `undefined value at parameter index ${valueIndex}.`
        )
      })
    })

    // warn about duplicate rules and tell user which rule indexes are duped
    const duplicateRuleIndexes                = rules
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

    const indexOfWildcardRule         = rules.findIndex((rule      ) =>
      rule.allReflectedArgs.some((reflectedArg              , index) => {
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
  rawRule                ,
  ruleIndex        
)                      {
                                                                       
  const parsed         = functionParse(rawRule)
  // Note: no way to tell if an argument is a rest argument (like (...args) => {})

  if (parsed.args.length === 0) {
    const reflectedArguments = []
    return reflectedArguments
  }

  return parsed.args.map((argName, argIndex) => {
    const isDestructured = argName === false
    const pattern         = parsed.defaults[argName]

    const reflectedArg               = {
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

function isType(constructor        , value     )          {
  return getType(value) === `[object ${constructor}]`
}

function getType(value     )         {
  return Object.prototype.toString.call(value)
}

function toRule(rawRule                , ruleIndex        )       {
  invariant(
    !(typeof rawRule === 'function'),
    `Rule at index ${ruleIndex} is not a ` +
      `Function, instead is: ${getType(rawRule)}.`
  )

  const allReflectedArgs                      = reflectArguments(
    rawRule,
    ruleIndex
  )

  const rule       = {
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

function isFloat(value     )          {
  return isType('Number', value) && value % 1 !== 0
}

function ruleIsWildcard(rule      )          {
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
  rule      ,
  values            ,
  ruleIndex        ,
  rules             
)          {
  return values.every((value     , valueIndex        ) => {
    const reflectedArg               = rule.allReflectedArgs[valueIndex]

    if (reflectedArg.isDestructured === true) {
      return true
    }

    // ReflectedArg type cannot have both `subPatterns` and `patterns` keys
    if ('subPatterns' in reflectedArg && !('patterns' in reflectedArg)) {
      return (
        reflectedArg.subPatterns &&
        reflectedArg.subPatterns.some(subPattern => {
          console.log('subPattern is:', subPattern)
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
  objectValue        ,
  valueIndex        ,
  rules             ,
  ruleIndex        ,
  objectPattern                            
)          {
  const valueSize = Object.keys(objectValue).length

                                                                 //
  let bestFitRules               = rules.reduce(
    (reduced              , rule      , index        ) => {
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
    ([]              )
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
        return patternKeys.every((key        ) => {
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
  arrayValue              ,
  valueIndex        ,
  rules             ,
  ruleIndex        ,
  arrayPattern                                 
)          {
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
function tryGetParentClassName(instance     )                {
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
  pattern     , // String type, actually (for the most part)
  ruleIndex        , // for error messages
  argIndex         // for error messages
)    
                                 
                          
                       
   {
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
  rules             ,
  ruleIndex        ,
  valueIndex        ,
  value     ,
  reflectedArg 
                  
                                                         
)          {
  if ('customTypeNames' in reflectedArg) {
    if (
      reflectedArg.customTypeNames != null &&
      reflectedArg.customTypeNames.includes(value.constructor.name)
    ) {
      return true
    }

    // derived class matching
    const valueParentTypeName          = tryGetParentClassName(value)
    if (
      valueParentTypeName &&
      reflectedArg.customTypeNames != null &&
      reflectedArg.customTypeNames.includes(valueParentTypeName)
    ) {
      return true
    }
  }
  const pattern      = reflectedArg.pattern

  if (isType('Function', pattern) && !constructors.includes(pattern)) {
    // `pattern` may be a match guard
    const guardResult      = pattern(value)

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
