/**
 * @flow
 * @prettier
 */

const DEV = process.env.NODE_ENV !== 'production'

// no duplicate warnings
let warned: Set<string> = new Set()

export let warning = function(condition: boolean, message: string): void {}

if (DEV) {
  warning = function(condition: boolean, message: string): void {
    if (!warned.has(message)) {
      if (condition) {
        // Do not repeat warning
        warned.add(message)

        if (typeof console !== 'undefined') {
          message = message.endsWith('.') ? message : message + '.'
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

export function invariant(condition: boolean, message: string): void {
  if (condition) {
    throw Error(message)
  }
}
