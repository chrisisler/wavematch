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
      JSON.stringify(rawRules.map(String), null, 2)
    // console.log('key is:', key)
    if (globalCache.has(key)) {
      // console.log('hit', globalCache.get(key))
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

            // TODO: There has got to be a better way to track which inputs
            // need to be mutated. Mapping them all is lazy and invites hacks.
            const boundInputs = inputs.map((input, index) => {
              if (isPlainObject(input) && '__SECRET_MUTATION' in input) {
                return input.__SECRET_MUTATION
              }

              let { argName } = rule.allReflectedArgs[index]
              return onlyUnderscoresIdentifier.test(argName) ? void 0 : input
            })

            const computed = rule.expression(...boundInputs)
            globalCache.set(key, computed)
            return computed
            // return rule.expression(...boundInputs)
          }
        }
      }
    }

    if (indexOfWildcardRule !== -1) {
      const computed = rules[indexOfWildcardRule].expression()
      globalCache.set(key, computed)
      return computed
      // return rules[indexOfWildcardRule].expression()
    }

    warning(true, 'End of wavematch - unhandled state.')
  }
}

wavematch.create = (...rawRules: *) => (...inputs: *) =>
  wavematch(...inputs)(...rawRules)
