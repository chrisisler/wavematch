const reflect = require('js-function-reflector')

// type RuleArg = {
//   argName: String
//   default?: Any
// }

module.exports = function wavematch (...values) {
  return function (...rules) {
    const rulesArgs = rules.map(rule => {
      const reflected = reflect(rule)
      return reflected.args.map(normalize)
    })

    const matchedRuleArgs = rulesArgs.find(ruleArgs => {
      if (values.length !== ruleArgs.length) {
        return false
      }
    })
  }
}

function normalize (arg) {
  if (isType('Array', arg)) {
    return {
      argName: arg[0],
      default: arg[1]
    }
  }
  return {
    argName: arg
  }
}

function isType (type, val) {
  return Object.prototype.toString.call(val) === `[object ${type}]`
}
