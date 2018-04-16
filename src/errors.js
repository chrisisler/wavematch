//@flow

const isNotProd = process.env.NODE_ENV !== 'production'

let warned: Set<string> = new Set()

let warning = function(condition: boolean, message: string): void {}

if (isNotProd) {
  warning = function(condition: boolean, message: string): void {
    if (!warned.has(message)) {
      if (condition) {
        // Do not repeat warning
        warned.add(message)

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
