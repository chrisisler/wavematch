/**
 * @flow
 * @prettier
 */

import isEqual from 'fast-deep-equal'

import type { RuleExpression, ReflectedArg, Rule } from './flow-types'
import { warning, invariant } from './error'
import {
  toRule,
  ruleIsWildcard,
  allInputsSatisfyRule,
  isPlainObject
} from './match'

const onlyUnderscoresIdentifier = /\b_+\b/

let globalCache = new Map()

function isFunction(x: any): boolean %checks {
  return typeof x === 'function'
}

function toString(x: any): string {
  // prettier-ignore
  return isFunction(x)
    ? String(x)
    : Array.isArray(x)
      ? x.map(toString)
      : JSON.stringify(x, null, 2)
}

export default function wavematch(...inputs: Array<any>): Function {
  invariant(
    inputs.length === 0,
    'Please supply at least one argument. Cannot match on zero parameters.'
  )

  return function(...rawRules: Array<RuleExpression>): $Call<RuleExpression> {
    invariant(
      rawRules.length === 0,
      'Non-exhaustive rules. ' +
        'Please add a rule function, or at least the wildcard rule: ' +
        '"_ => { /* expression */ }"'
    )

    // Caching depends on both the inputs and the rules provided.
    const key =
      JSON.stringify(inputs.map(toString), null, 2) +
      JSON.stringify(rawRules.map(String), nul, 2)
    if (globalCache.has(key)) {
      return globalCache.get(key)
    }

    const rules: Array<Rule> = rawRules.map(toRule)

    // Invariant: Cannot destructure undefined
    inputs.forEach((input: any, inputIndex) => {
      rules.forEach((rule: Rule, ruleIndex) => {
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

    // // Warning: Duplicate rule
    // const duplicateRuleIndexes: Array<number> = rules
    //   .filter(rule => !rule.allReflectedArgs.some(args => args.isDestructured))
    //   .reduce((reduced, rule, index, filtered) => {
    //     const duplicateRuleIndex = filtered.findIndex(
    //       (otherRule, otherIndex) =>
    //         index !== otherIndex &&
    //         isEqual(otherRule.allReflectedArgs, rule.allReflectedArgs)
    //     )
    //     if (duplicateRuleIndex !== -1) {
    //       reduced.push(index)
    //     }
    //     return reduced
    //   }, [])
    // warning(
    //   duplicateRuleIndexes.length !== 0,
    //   `Duplicate rules found at indexes ${duplicateRuleIndexes.join(' and ')}`
    // )

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
        return ruleIsWildcard(rule)
      })
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
                '__SECRET_MUTATION' in input
              ) {
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
  }
}

wavematch.create = (...rawRules: *) => (...inputs: *) =>
  wavematch(...inputs)(...rawRules)
