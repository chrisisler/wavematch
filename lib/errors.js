//     

const isNotProd = process.env.NODE_ENV !== 'production'

let warned              = new Set()

let warning = function(condition         , message        )       {
  // empty
}

if (isNotProd) {
  warning = function(condition         , message        )       {
    if (!warned.has(message)) {
      if (condition) {
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

function invariant(condition         , message        )       {
  if (condition) {
    throw Error(message)
  }
}

module.exports = {
  warning,
  invariant
}
