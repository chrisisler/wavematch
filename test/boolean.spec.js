const assert = require('assert')
const wavematch = require('../lib/index.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch boolean specification', () => {
  it('should match Boolean constructor', () => {
    const falseMatch = wavematch(false)(
      (input = Boolean) => accept,
      _ => reject
    )
    eq(falseMatch, accept)

    const trueMatch = wavematch(true)(
      (input = Boolean) => accept,
      _ => reject
    )
    eq(trueMatch, accept)
  })

  it('should match false literal', () => {
    const matchFalse = wavematch(false)(
      (condition = false) => accept,
      _ => reject
    )
    eq(matchFalse, accept)
  })

  it('should match true literal', () => {
    const matchTrue = wavematch(true)(
      (condition = true) => accept,
      _ => reject
    )
    eq(matchTrue, accept)
  })

  it('should reject non-Boolean inputs with Boolean constructor', () => {
    const matchBoolean = input => wavematch(input)(
      (arg = Boolean) => accept,
      _ => reject
    )

    const emptyArray = []
    const fn = _ => {} // cannot contain parenthesis or else SyntaxError (via json5 spec)
    const number = 1
    const string = 'i am a string'

    const S = new Set()
    const M = new Map()

    const elements = [emptyArray, fn, number, string, S, M]

    // should reject all non-booleans
    elements.forEach(element => {
      eq(matchBoolean(element), reject)
    })
  })
})
