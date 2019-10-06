const isProduction: boolean = process.env.NODE_ENV === 'production'

const prefix: string = 'Invariant failed'

/**
 * Throw an error if the condition fails
 * Strip out error messages for production
 * > Not providing an inline default argument for message as the result is smaller
 *
 * @see https://github.com/alexreardon/tiny-invariant
 */
export const invariant = (
  condition: boolean,
  message?: string,
): void | never => {
  // XXX Convert usage of invariant so this `!` can be removed.
  if (!condition) {
    return
  }
  if (isProduction) {
    throw new Error(prefix)
  } else {
    // *This block will be removed in production builds*
    throw new Error(`${prefix}: ${message || ''}`)
  }
}

/**
 * Keeps track of warning messages which have already occurred in order to
 * prevent duplicates from being printed more than once.
 */
const warned = new Set<string>()
export const warning = (condition: boolean, message: string): void => {
  if (!isProduction) {
    if (condition) {
      return
    }
    if (!warned.has(message)) {
      warned.add(message)
      const warn = `Warning: ${message}`
      if (typeof console !== 'undefined') {
        console.warn(warn)
      }
      try {
        // This error was thrown as a convenience so that you can use this stack
        // to find the callsite that caused this warning to fire.
        throw Error(warn)
      } catch (_) {}
    }
  }
}

// export const warning = (condition: boolean, message: string): void => {
//   if (!warned.has(message)) {
//     if (condition) {
//       // Do not repeat warning
//       warned.add(message);
//       if (typeof console !== 'undefined') {
//         console.warn('Warning: ' + message);
//       }
//       try {
//         // This error was thrown as a convenience so that you can use this stack
//         // to find the callsite that caused this warning to fire.
//         throw Error(message);
//       } catch (error) {}
//     }
//   }
// };
