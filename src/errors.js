//@flow

const isNotProd = process.env.NODE_ENV !== 'production'

let warning = function(condition: boolean, message: string): void {
  // empty
}

if (isNotProd) {
  warning = function(condition: boolean, message: string): void {
    if (condition) {
      if (typeof console !== 'undefined') {
        console.warn('Warning: ' + message)
      }
      try {
        // This error was thrown as a convenience so that you can use this stack
        // to find the callsite that caused this warning to fire.
        throw Error(message)
      } catch (error) {}
    }
  }
}

function invariant(condition: boolean, message: string): void {
  if (condition) {
    throw Error(message)
  }
}

module.exports = {
  warning,
  invariant
}
