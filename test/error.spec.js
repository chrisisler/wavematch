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
  it('should allow `Error` to match all other standard Error types', () => {
    let matchStandardError = standardErrorType => wavematch(standardErrorType)(
      (e = Error) => accept,
      _ => reject
    )

    allErrorTypes.forEach(errorType => {
      eq(matchStandardError(errorType()), accept)
    })
  })
})
