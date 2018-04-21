const assert = require('assert')
const wavematch = require('../build/index.js')
const { accept, reject, eq } = require('./shared.js')

const allErrorTypes = [
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError,
  Error
]

describe('wavematch Error type specification', () => {
  it('should allow `Error` as pattern to accept all other standard Error types', () => {
    const matchStandardError = standardErrorType => wavematch(standardErrorType)(
      (e = Error) => accept,
      _ => reject
    )

    allErrorTypes.forEach(errorType => {
      eq(matchStandardError(errorType()), accept)
    })
  })

  // now just gotta write tests for all of the other Error subtypes
  // RangeError, ReferenceError, TypeError, URIError, EvalError ...
  it('should accept specific Error subtypes via that constructor', () => {
    let match = wavematch(SyntaxError())(
      (e = RangeError) => reject,
      (e = SyntaxError) => accept,
      (e = URIError) => reject,
      _ => reject
    )

    eq(match, accept)
  })
})
