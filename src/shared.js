/**
 * @flow
 * @prettier
 */

export function isType(constructor: string, value: any): boolean {
  return getType(value) === `[object ${constructor}]`
}

export function getType(value: any): string {
  return Object.prototype.toString.call(value)
}

// Note: returns `true` for Strings
export function isArrayLike(value: any): boolean {
  return (
    value != null &&
    !isType('Function', value) &&
    !isType('GeneratorFunction', value) &&
    isType('Number', value.length) &&
    value.length > -1 &&
    value.length % 1 === 0 &&
    value.length <= Number.MAX_SAFE_INTEGER
  )
}

export function isFloat(value: any): boolean {
  return isType('Number', value) && value % 1 !== 0
}

export function every(
  values: Array<any>,
  predicate: (any, number, Array<any>) => boolean
): boolean {
  const length = values == null ? 0 : values.length
  let index = -1

  if (length === 0) {
    return false
  }

  while (++index < length) {
    if (!predicate(values[index], index, values)) {
      return false
    }
  }

  return true
}
