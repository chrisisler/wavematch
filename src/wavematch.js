/**
 * @flow
 * @prettier
 */

import isEqual from 'fast-deep-equal'

import type { RuleExpression, ReflectedArg, Rule } from './flow-types'
import { warning, invariant } from './error'
import { toRule, ruleIsWildcard, allInputsSatisfyRule } from './match'
import { isType } from './shared'

module.exports = function wavematch(...inputs: Array<any>): Function {
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

    // warn about duplicate rules and tell user which rule indexes are duplicates
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
