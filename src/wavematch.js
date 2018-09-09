/**
 * @flow
 * @prettier
 */

import isEqual from 'fast-deep-equal'

import type { RuleExpression, ReflectedArg, Rule } from './flow-types'
import { warning, invariant } from './error'
import { toRule, ruleIsWildcard, allInputsSatisfyRule } from './match'

// Avoid calculating the same thing twice
// let cache: Map<*, $Call<RuleExpression>> = new Map()

const onlyUnderscoresIdentifier = /\b_+\b/

export default function wavematch(...inputs: Array<any>): Function {
  invariant(
    inputs.length === 0,
    'Please supply at least one argument to ' +
      'match function. Cannot match on zero parameters.'
  )

  return function(...rawRules: Array<RuleExpression>): $Call<RuleExpression> {
    invariant(
      rawRules.length === 0,
      'Non-exhaustive rules. ' +
        'Please add a rule function, or at least the wildcard rule: ' +
        '"_ => { /* expression */ }"'
    )

    // TODO(cache)
    // let previous = cache.get(inputs.toString() + rawRules.toString())
    // if (previous !== undefined) {
    //   return previous
    // }

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

    // warn about duplicate rules and tell user which rule indexes are duplicates
    const duplicateRuleIndexes: Array<number> = rules
      .filter(rule => !rule.allReflectedArgs.some(args => args.isDestructured))
      .reduce((reduced, rule, index, filtered) => {
        const duplicateRuleIndex = filtered.findIndex(
          (otherRule, otherIndex) =>
            index !== otherIndex &&
            isEqual(otherRule.allReflectedArgs, rule.allReflectedArgs)
        )

        if (duplicateRuleIndex !== -1) {
          reduced.push(index)
        }

        return reduced
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
      rule.allReflectedArgs.some((reflectedArg: ReflectedArg) => {
        if (reflectedArg.isDestructured) {
          return false
        }
        if (!reflectedArg.argName.includes('_')) {
          return false
        }

        // warning(
        //   reflectedArg.argName.length > 1,
        //   `Wildcard argument name contains ${reflectedArg.argName.length} ` +
        //     'underscore characters. Expected only one underscore.'
        // )
        return ruleIsWildcard(rule)
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
            // DEV: The problem now is the function body doesn't capture vars
            // from outside scope. The below example throws ReferenceError.
            // How do we inject/capture those vars?
            // let x = 'foo'
            // wavematch(1)(_ => x)
            // let argNames = rule.allReflectedArgs.map(_ => _.argName)
            // $FlowFixMe Flow doesn't know that `...stringArray` type = string
            // let expressionWithoutDefaults = new Function(...argNames, rule.body)
            // let calculation = expressionWithoutDefaults(...inputs)

            // TODO(cache)
            // if (calculation !== undefined) {
            //   cache.set(inputs.toString() + rawRules.toString(), calculation)
            // }

            // If arg name is `_` then bind void 0 to that arg for the closure:
            const boundInputs = inputs.map((input, index) => {
              let { argName } = rule.allReflectedArgs[index]
              return onlyUnderscoresIdentifier.test(argName) ? void 0 : input
            })

            return rule.expression(...boundInputs)
          }
        }
      }
    }

    if (indexOfWildcardRule !== -1) {
      return rules[indexOfWildcardRule].expression()
    }

    warning(true, 'End of wavematch - unhandled state.')
  }
}
