const assert = require('assert')
const wavematch = require('../build/index.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch regular expression specification', () => {
  it('should match RegExp constructor', () => {
    let testRegExpConstructor = value => eq(wavematch(value)(
      (re = RegExp) => accept,
      _ => reject
    ), accept)

    testRegExpConstructor(/foo/)
    testRegExpConstructor(RegExp())
    testRegExpConstructor(new RegExp())
  })
})
