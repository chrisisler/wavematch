import JSON5 from 'json5';
import isEqual from 'fast-deep-equal';
import makeFunctionParse from 'parse-function';

/**
 * 
 * @prettier
 */

// no duplicate warnings
let warned = new Set();

let warning = function (condition, message) {};

{
  warning = function (condition, message) {
    if (!warned.has(message)) {
      if (condition) {
        // Do not repeat warning
        warned.add(message);

        if (typeof console !== 'undefined') {
          message = message.endsWith('.') ? message : message + '.';
          console.warn('Wavematch Warning: ' + message);
        }

        try {
          // This error was thrown as a convenience so that you can use this stack
          // to find the callsite that caused this warning to fire.
          throw Error(message);
        } catch (error) {}
      }
    }
  };
}

function invariant(condition, message) {
  if (condition) {
    throw Error(message);
  }
}

/**
 * 
 * @prettier
 */

function isType(constructor, value) {
  return getType(value) === `[object ${constructor}]`;
}

function getType(value) {
  return Object.prototype.toString.call(value);
}

// Note: returns `true` for Strings
function isArrayLike(value) {
  return value != null && !isType('Function', value) && !isType('GeneratorFunction', value) && isType('Number', value.length) && value.length > -1 && value.length % 1 === 0 && value.length <= Number.MAX_SAFE_INTEGER;
}

function isFloat(value) {
  return isType('Number', value) && value % 1 !== 0;
}

function every(values, predicate) {
  const length = values == null ? 0 : values.length;
  let index = -1;

  if (length === 0) {
    return false;
  }

  while (++index < length) {
    if (!predicate(values[index], index, values)) {
      return false;
    }
  }

  return true;
}

/**
 * 
 * @prettier
 */
let functionParse = makeFunctionParse().parse;

const ERROR_TYPES_DICTIONARY = {
  EvalError: EvalError,
  RangeError: RangeError,
  ReferenceError: ReferenceError,
  SyntaxError: SyntaxError,
  TypeError: TypeError,
  URIError: URIError,
  Error: Error
};

const values = obj => Object.keys(obj).map(key => obj[key]);

const TYPES = [Object, Boolean, Number, Function, Array, String, RegExp, Date, Set, Map, Symbol, Proxy].concat(values(ERROR_TYPES_DICTIONARY));

function reflectArguments(rawRule, ruleIndex) {
  const parsed = functionParse(rawRule);
  // Note: no way to tell if an argument is a rest argument (like (...args) => {})

  if (parsed.args.length === 0) {
    const reflectedArguments = [];
    return reflectedArguments;
  }

  return parsed.args.map((argName, argIndex) => {
    const isDestructured = argName === false;
    const pattern = parsed.defaults[argName];

    const reflectedArg = {
      isDestructured: isDestructured,
      body: parsed.body,
      argName: isDestructured ? '@@DESTRUCTURED' : argName

      // if no default then do not add optional keys
    };if (pattern === void 0) {
      return reflectedArg;
    }

    const { customTypeNames, evaulatedPattern, subPatterns } = reflectPattern(pattern, ruleIndex, argIndex);

    let optionalProps = {};

    if (customTypeNames.length) {
      optionalProps.customTypeNames = customTypeNames;
    }

    if (subPatterns.length) {
      optionalProps.subPatterns = subPatterns;
    } else {
      optionalProps.pattern = evaulatedPattern;
    }

    const r = Object.assign({}, reflectedArg, optionalProps);
    return r;
  });
}

function toRule(rawRule, ruleIndex) {
  invariant(!(typeof rawRule === 'function'), `Rule at index ${ruleIndex} is not a ` + `Function, instead is: ${getType(rawRule)}.`);

  const allReflectedArgs = reflectArguments(rawRule, ruleIndex);

  const rule = {
    allReflectedArgs: allReflectedArgs,
    expression: rawRule,
    arity: allReflectedArgs.length
  };

  warning(rule.arity === 0, `${rawRule.name === 'anonymous' || rawRule.name === '' ? 'Anonymous rule' : `Rule "${rawRule.name}"`} at index ${ruleIndex} must accept one or more arguments.`);

  return rule;
}

function ruleIsWildcard(rule) {
  return rule.allReflectedArgs.some(arg => arg.argName === '_');
}

function allInputsSatisfyRule(rule, inputs, ruleIndex, rules) {
  return every(inputs, (input, inputIndex) => {
    const reflectedArg = rule.allReflectedArgs[inputIndex];

    if (reflectedArg.isDestructured === true) {
      return true;
    }

    // ReflectedArg type may either have `subPatterns` or `pattern` key,
    // but not both at the same time.
    if ('subPatterns' in reflectedArg && !('pattern' in reflectedArg)) {
      if (reflectedArg.subPatterns != null) {
        return reflectedArg.subPatterns.some(subPattern => {
          let subReflectedArg = {
            pattern: subPattern,
            customTypeNames: reflectedArg.customTypeNames
          };

          return isPatternAcceptable(rules, ruleIndex, inputIndex, input, subReflectedArg);
        });
      }
    }

    if ('pattern' in reflectedArg) {
      return isPatternAcceptable(rules, ruleIndex, inputIndex, input, reflectedArg);
    }

    return true;
  });
}

// when the input value at `valueIndex` is of type Object
function ruleMatchesObjectInput(objectInput, inputIndex, rules, ruleIndex, objectPattern) {
  const desiredKeys = Object.keys(objectInput);
  const inputSize = desiredKeys.length;

  //
  let bestFitRules = rules.reduce((reduced, rule, index) => {
    if (ruleIsWildcard(rule)) return reduced; // skip

    const r = rule.allReflectedArgs[inputIndex];

    function pushIfValidSize(pattern) {
      if (isPlainObject(pattern)) {
        const size = Object.keys(pattern).length;

        // cannot have more keys than the object we are trying to match
        if (size <= inputSize) {
          reduced.push({ size, index });
        }
      }
    }

    if ('pattern' in r && typeof r.pattern === 'object') {
      pushIfValidSize(r.pattern);
    } else if ('subPatterns' in r && typeof r.subPatterns !== 'undefined') {
      r.subPatterns.forEach(pushIfValidSize);
    }

    return reduced;
  }, []);

  // pattern matches any object: `(arg = Object) => { ... }`
  if (Object === objectPattern) {
    return !bestFitRules.some(b => b.index > ruleIndex);
  } else if (isType('Object', objectPattern)) {
    const patternKeys = Object.keys(objectPattern);

    if (patternKeys.length === 0) {
      return isEqual(objectPattern, objectInput);
    }

    if (patternKeys.length <= inputSize) {
      // get obj with highest number of keys (hence the name "best fit")
      const bestFitRule = bestFitRules.sort((b1, b2) => b1.size > b2.size ? -1 : 1)[0];

      // retain only the rules that have the most keys
      // this may not eliminate any rules, that is okay
      bestFitRules = bestFitRules.filter(b => b.size >= bestFitRule.size);

      if (bestFitRules.some(b => b.index === ruleIndex)) {
        return every(patternKeys, key => {
          return isEqual(objectPattern[key], objectInput[key]);
        });
      }
    } else {
      // `pattern` has more keys than objectInput (do not warn)
      return false;
    }
  }

  const reflectedArg = rules[ruleIndex].allReflectedArgs[inputIndex];

  // TODO add forgiveness for mispelling and missed capitalization,
  //   and provide a warning for it.
  if (desiredKeys.includes(reflectedArg.argName)) {
    const anyValueSatisfiesPattern = Object.keys(objectInput).some((objectInputKey, index) => {
      const objectInputValue = objectInput[objectInputKey];

      return isPatternAcceptable(rules, ruleIndex, index, objectInputValue, reflectedArg);
    });

    return anyValueSatisfiesPattern;
  }

  return false;
}

function ruleMatchesArrayInput(arrayInput, inputIndex, rules, ruleIndex, pattern) {
  if (Array === pattern) {
    // index of a rule that is not this current rule (`rules[ruleIndex]`)
    // whose pattern destructures an array input
    const indexOfDestructuringRule = rules.findIndex(rule => {
      if (ruleIsWildcard(rule)) {
        return false;
      }

      const reflectedArgs = rule.allReflectedArgs[inputIndex];

      if ('pattern' in reflectedArgs && reflectedArgs.pattern != null && isType('Array', reflectedArgs.pattern)) {
        // `reflArg.pattern` mismatches: too many elements
        return reflectedArgs.pattern.length <= arrayInput.length;
      }
    });

    if (indexOfDestructuringRule !== -1) {
      return indexOfDestructuringRule < ruleIndex;
    }

    return isType('Array', arrayInput);
  }

  if (isType('Array', pattern)) {
    if (arrayInput.length === 0) {
      return isEqual(pattern, arrayInput);
    } else if (pattern.length > arrayInput.length) {
      return false;
    } else if (pattern.length <= arrayInput.length) {
      // pattern is `[]` but value is not
      if (pattern.length === 0) {
        return false;
      }

      const thisRuleIsOnlyDestructurer = rules.length === 2;

      if (thisRuleIsOnlyDestructurer) {
        if (pattern) return every(pattern, (destructuredArrayValue, index) => {
          return isEqual(destructuredArrayValue, arrayInput[index]);
        });
      }

      return isEqual(pattern, arrayInput);
    }
  }

  // fallback behavior
  return false;
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
function tryGetParentClassName(instance) {
  if (isType('Null', instance) || isType('Undefined', instance)) {
    return;
  }

  // Flow (version ^0.66.0) cannot follow the isType() calls unfortunately.
  // $FlowFixMe
  const code = instance.constructor.toString();
  // // TODO: Support subclassing this way (see `demo.js`).
  // console.log('code is:', code)

  if (!code.includes('class') || !code.includes('extends')) {
    return;
  }

  const parts = code.split(/\s+/).slice(0, 4);

  invariant(parts[2] !== 'extends', `Expected "class Foo extends Bar". Found "${parts.join(' ')}"`);

  const parentClassName = parts[3];
  return parentClassName;
}

// for `reflectArguments` only
function reflectPattern(pattern, // String type, actually (until `eval`uated or `JSON.parse`d)
ruleIndex, // for error messages
argIndex // for error messages
) {
  let customTypeNames = [];
  let subPatterns = [];

  // OR pattern
  // ----------
  // wavematch(random(0, 5))(
  //   (n = 1 | 3 | 5) => 'odd!',
  //   _ => 'even!'
  // )
  // Note: `pattern` = '1 | 3 | 5'
  //   Must split then evaluate iteratively.
  if (pattern.includes('|')) {
    const patterns = pattern.split(/\s*\|\s*/);
    patterns.forEach(subPattern => {
      // When this function call hits the `if (pattern.includes('|'))` case
      // again, this code will not run. In other words, this recursion happens
      // a maximum of one times, potentially zero if no pattern has sub patterns.
      const sub = reflectPattern(subPattern, ruleIndex, argIndex);
      subPatterns.push(sub.evaulatedPattern);

      // Extract all custom types from the union.
      if (sub.customTypeNames.length) {
        customTypeNames.push(...sub.customTypeNames);
      }
    });

    // https://stackoverflow.com/questions/840781
    // I don't slice() before sort() because mutating order doesn't matter here.
    const duplicates = patterns.sort().filter((value, index, sorted) => sorted[index + 1] === value);
    if (duplicates.length > 0) {
      warning(true, `Rule at index ${ruleIndex} contains duplicate pattern(s): ${duplicates.map(duplicated => `\`${duplicated}\``).join(' and ')}`);
    }
  } else {
    // pattern is a plain object, parse it into an actual Object type
    if (pattern.includes('{')) {
      try {
        // data must conform to json5 spec
        pattern = JSON5.parse(pattern);
      } catch (error) {
        invariant(error instanceof SyntaxError, `Rule at index ${ruleIndex} has argument at parameter index ` + `${argIndex} that has invalid JSON.\n${error.message || error}\n`);
      }
    } else {
      try {
        pattern = eval(pattern);
      } catch (error) {
        // This `catch` block occurs when a var name is used as a pattern,
        // causing a ReferenceError.
        // The following code MAKES A DANGEROUS ASSUMPTION that the
        // names/identifiers used as patterns are not PascalCase when the
        // name/identifier is NOT a class (because class names (Car, Person,
        // Queue, etc.) represent type-matching).
        const identifierOutOfScope = error instanceof ReferenceError;
        const identifierIsUpperCase = pattern[0].toUpperCase() === pattern[0];
        if (identifierOutOfScope && identifierIsUpperCase) {
          // checking if the custom type actually matches is not our job here,
          // that's done in `allInputsSatisfyRule`
          customTypeNames.push(pattern);
        }

        invariant(identifierOutOfScope && pattern[0].toLowerCase() === pattern[0], `For pattern at parameter index ${argIndex}, cannot use out of ` + `scope variable as default: ${pattern}.\n` + `If possible, try replacing the variable with its value.`);
      }
    }
  }

  return {
    evaulatedPattern: pattern,
    subPatterns,
    customTypeNames
  };
}

// isPlainObject(new MyClass()) //=> false
// isPlainObject([]) //=> false
// isPlainObject({}) //=> true
// isPlainObject({ x: 2 }) //=> true
// isPlainObject(Object.create(null)) //=> false
// https://github.com/reduxjs/redux/blob/master/src/utils/isPlainObject.js
// Only used for `isPatternAcceptable()` function in this file.
function isPlainObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  let proto = obj;

  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }

  return Object.getPrototypeOf(obj) === proto;
}

// TODO Extract conditionals to a separate function (like Yegor256 says).
function isPatternAcceptable(rules, ruleIndex, inputIndex, input,
// ReflectedArg or SubReflectedArg
reflectedArg) {
  // The following `if` statement handles the custom classes situation, like:
  // class Person {}
  // wavematch(new Person())(
  //   (x = Person) => 'awesome'
  // )
  if ('customTypeNames' in reflectedArg) {
    if (reflectedArg.customTypeNames != null && reflectedArg.customTypeNames.includes(input.constructor.name)) {
      return true;
    }

    // derived class matching
    const inputParentTypeName = tryGetParentClassName(input);

    if (inputParentTypeName && reflectedArg.customTypeNames != null && reflectedArg.customTypeNames.includes(inputParentTypeName)) {
      return true;
    }
  }

  const pattern = reflectedArg.pattern;

  if (!TYPES.includes(pattern)) {
    if (isType('Promise', pattern) && typeof pattern.then === 'function') {
      return true;
      // Support promises?
      // return pattern.then(promised =>
      //   isPatternAcceptable(rules, ruleIndex, inputIndex, input, promised)
      // )
    } else if (isType('Function', pattern)) {
      // `pattern` may be a match guard
      const guardResult = pattern(input);

      invariant(!isType('Boolean', guardResult), `Rule at rule index ${ruleIndex} has a guard function at parameter ` + `index ${inputIndex} that does NOT return a Boolean value. ` + `Expected a predicate (Boolean-returning function). Found ${getType(guardResult)}.`);

      if (guardResult) {
        return true;
      }
    }
  }

  // eensy-teensy bit of type-coersion here (`arguments` -> array)
  // the `isArrayLike` predicate evaluates true for Strings: exclude those
  if (isArrayLike(input) && !isType('String', input)) {
    const arrayInput = isType('Array', input) ? input : Array.from(input);
    return ruleMatchesArrayInput(arrayInput, inputIndex, rules, ruleIndex, pattern);
  }

  // detecting Date objects requires the `new` keyword
  if (isType('Date', input)) {
    if (Date === pattern) {
      return true;
    }
    // return isEqual(pattern, input)
  }

  if (isPlainObject(input)) {
    return ruleMatchesObjectInput(input, inputIndex, rules, ruleIndex, pattern);
  }

  if (isFloat(input)) {
    return isEqual(pattern, input);
  }

  if (isType('Number', input)) {
    if (Number === pattern) {
      const otherRuleMatches = rules.some(rule => {
        if (ruleIsWildcard(rule)) return false;

        const reflectedArgs = rule.allReflectedArgs[inputIndex];

        if ('pattern' in reflectedArgs && reflectedArgs.pattern != null && isType('Number', reflectedArgs.pattern)) {
          return reflectedArgs.pattern === input;
        }
      });

      if (otherRuleMatches) {
        return false;
      }
      return true;
    }
    // whole numbers (includes 3, excludes 3.0)
    return input === pattern;
  }

  if (isType('Function', input) || isType('GeneratorFunction', input)) {
    if (Function === pattern) {
      return true;
    }
  }

  if (isType('Boolean', input)) {
    if (Boolean === pattern) {
      return true;
    }

    if (pattern === input) {
      return true;
    }
  }

  if (isType('String', input)) {
    if (String === pattern) {
      const otherRuleMatches = rules.some(rule => {
        if (ruleIsWildcard(rule)) return false;

        const reflectedArgs = rule.allReflectedArgs[inputIndex];

        if ('pattern' in reflectedArgs && reflectedArgs.pattern != null && isType('String', reflectedArgs.pattern)) {
          return reflectedArgs.pattern === input;
        }
      });

      if (otherRuleMatches) {
        return false;
      }
      return true;
    }
    // must use `toString` to support use of `new` keyword for String
    if (pattern === input.toString()) {
      return true;
    }
  }

  // does not work for custom errors like `class MyError extends Error {}`
  //   (besides, custom types should be handled earlier in this function)
  // `input` must be a standard built-in error type
  if (isType('Error', input)) {
    // `(arg = Error) => {}` will match an input value that is any instance
    // of standard (built-in) error type (SyntaxError, RangeError, etc.)
    if (pattern === Error) {
      return true;
    }

    // we know `input` is an Error instance, but what type of error?
    // this is for handling all Error types that are not the base `Error` class
    return Object.keys(ERROR_TYPES_DICTIONARY).some(errorTypeName => {
      const errorType = ERROR_TYPES_DICTIONARY[errorTypeName];
      return errorType === pattern && input.constructor.name === errorTypeName;
    });
  }

  if (isType('Null', input)) {
    if (input === pattern) {
      return true;
    }
  }

  if (isType('Undefined', input)) {
    if (input === pattern) {
      return true;
    }
  }

  if (isType('RegExp', input)) {
    if (RegExp === pattern) {
      return true;
    }
  }

  return false;
}

/**
 * 
 * @prettier
 */

module.exports = function wavematch(...inputs) {
  invariant(inputs.length === 0, 'Please supply at least one argument to ' + 'match function. Cannot match on zero parameters.');

  return function (...rawRules) {
    invariant(rawRules.length === 0, 'Non-exhaustive rules. ' + 'Please add a rule function, or at least the wildcard rule: ' + '"_ => { /* expression */ }"');

    const rules = rawRules.map(toRule);

    // if any rule tries to destructure an undefined input value then throw
    inputs.forEach((input, inputIndex) => {
      rules.forEach((rule, ruleIndex) => {
        // skip wildcard rule and skip rules that expect fewer args than given
        if (ruleIsWildcard(rule) || inputIndex >= rule.arity) {
          return;
        }

        const reflectedArg = rule.allReflectedArgs[inputIndex];

        invariant(reflectedArg.isDestructured === true && input === void 0, `Rule at index ${ruleIndex} attempts to destructure an ` + `undefined value at parameter index ${inputIndex}.`);
      });
    });

    // warn about duplicate rules and tell user which rule indexes are duplicates
    const duplicateRuleIndexes = rules.filter(rule => !rule.allReflectedArgs.some(args => args.isDestructured)).reduce((reducedIndexes, rule, index, nonDestructuredRules) => {
      const duplicateRuleIndex = nonDestructuredRules.findIndex((otherRule, otherIndex) => index !== otherIndex && isEqual(otherRule.allReflectedArgs, rule.allReflectedArgs));

      if (duplicateRuleIndex !== -1) {
        reducedIndexes.push(index);
      }

      return reducedIndexes;
    }, []);

    warning(duplicateRuleIndexes.length !== 0, `Duplicate rules found at indexes ${duplicateRuleIndexes.join(' and ')}`);

    const indexOfRuleOverArity = rules.findIndex(r => r.arity > inputs.length);

    if (indexOfRuleOverArity !== -1) {
      warning(true, `Rule at index ${indexOfRuleOverArity} tries to match ` + `${rules[indexOfRuleOverArity].arity} arguments. Expected only ` + `${inputs.length} parameters.`);
    }

    const indexOfWildcardRule = rules.findIndex(rule => rule.allReflectedArgs.some((reflectedArg, index) => {
      if (reflectedArg.isDestructured) {
        return false;
      }
      if (!reflectedArg.argName.includes('_')) {
        return false;
      }

      warning(reflectedArg.argName.length > 1, `Wildcard argument name contains ${reflectedArg.argName.length} ` + 'underscore characters. Expected only one underscore.');

      return reflectedArg.argName.includes('_') && rule.arity === 1;
    }));

    for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
      // skip wildcard pattern as it:
      // 1) might not exist
      // 2) might not be at the last index like it's supposed to be
      if (ruleIndex !== indexOfWildcardRule) {
        const rule = rules[ruleIndex];

        if (rule.arity === inputs.length) {
          if (allInputsSatisfyRule(rule, inputs, ruleIndex, rules)) {
            return rule.expression(...inputs);
          }
        }
      }
    }

    if (indexOfWildcardRule !== -1) {
      return rules[indexOfWildcardRule].expression();
    }

    warning(true, 'Gotta show a warning - end of `wavematch` with an unhandled state!');
  };
};
