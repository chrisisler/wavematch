import { PrimitiveConstructorName, PrimitiveConstructor } from 'interfaces';

const primitiveConstructors = new Map<PrimitiveConstructorName, PrimitiveConstructor>([
    ['String', String],
    ['Function', Function],
    ['Number', Number],
    ['Boolean', Boolean],
    ['Symbol', Symbol],
    ['BigInt', BigInt],
    ['Object', Object],
    ['Array', Array],
    ['RegExp', RegExp],
    ['Error', Error],
]);

export const isKnownConstructor = (str: string): str is PrimitiveConstructorName =>
    primitiveConstructors.has(str as PrimitiveConstructorName);

/**
 * For impossible states.
 *
 * @example
 *
 * // Bad, TypeScript will not acknowledge control flow redirection:
 * Unreachable();
 *
 * // Good:
 * return Unreachable();
 */
export const Unreachable = (data?: unknown): never => {
    if (data !== undefined && data !== null) {
        throw TypeError(`Unreachable: ${data}`);
    }
    throw TypeError('Unreachable');
};

/**
 * Check if something is a plain JS object. Returns false for class
 * instances, `Object.create(null)`, arrays, and null.
 */
export const isPlainObject = <K extends string | number | symbol, V>(
    obj: unknown
): obj is Record<K, V> => {
    if (typeof obj !== 'object' || obj === null) return false;
    let proto = obj;
    while (Object.getPrototypeOf(proto) !== null) proto = Object.getPrototypeOf(proto);
    return Object.getPrototypeOf(obj) === proto;
};

/**
 * Is the first character of a given string in capitalized?
 */
export const isUpperFirst = (str: string): boolean => str[0] === str[0].toUpperCase();

export const flatMap = <T, Result>(
    array: T[],
    fn: (value: T, index: number, array: T[]) => Result[]
): Result[] => ([] as Result[]).concat(...array.map(fn));

export const hasProperty = Function.call.bind(Object.prototype.hasOwnProperty);