const assert = require('assert')

exports.accept = 'ACCEPT'
exports.reject = 'REJECT'

exports.eq = function eq(actual, expected) {
  assert.strictEqual(arguments.length, 2)
  assert.strictEqual(actual, expected)
}
