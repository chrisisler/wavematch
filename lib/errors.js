//     

const { EOL: newLine } = require('os')

// for accumulating error stack traces
let errors                = []

/**
 * accesses and mutates `errors: Array<string>` outside of this scope
 */
function collectError(error       )       {
  // write this function name, file name, line number, and column number
  // to the `.stack` String prop of the supplied object
  // Error.captureStackTrace(error)
  errors.push(error.stack)
}

/**
 * @throws {Error}
 */
function maybeThrowAndFlushErrors()       {
  const separator         = [...Array(80)].map(() => '-').join('')

  if (errors.length === 1) {
    const message =
      'Aborting due to error:' +
      newLine +
      newLine +
      errors[0] +
      newLine +
      newLine +
      separator +
      newLine
    const singleError = Error(message)

    // flush array
    errors.length = 0

    throw singleError
  } else if (errors.length > 1) {
    const multiErrorStack = errors.join(newLine + newLine) + newLine
    const message =
      `Aborting due to ${errors.length} errors:` +
      newLine +
      newLine +
      multiErrorStack +
      newLine +
      separator +
      newLine
    const multiError = Error(message)

    // flush array
    errors.length = 0

    throw multiError
  }
}

const isNotProd = process.env.NODE_ENV !== 'production'

let warning = function (condition         , message        )       {}

if (isNotProd) {
  warning = function (condition         , message        )       {
    if (condition) {
      if (typeof console !== 'undefined') {
        console.warn(message)
      }
      try {
        // This error was thrown as a convenience so that you can use this stack
        // to find the callsite that caused this warning to fire.
        throw Error(message)
      } catch (error) {}
    }
  }
}

function invariant (condition         , message        )       {
  if (condition) {
    throw Error(message)
  }
}

module.exports = {
  warning,
  invariant,
  collectError,
  maybeThrowAndFlushErrors
}
