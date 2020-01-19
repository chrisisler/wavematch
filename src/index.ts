import { parseExpression as babelParse } from '@babel/parser';
import {
    ArrayExpression,
    BinaryExpression,
    Expression,
    Identifier,
    isArrayExpression,
    isArrowFunctionExpression,
    isBigIntLiteral,
    isBooleanLiteral,
    isIdentifier,
    isNullLiteral,
    isNumericLiteral,
    isObjectExpression,
    isPatternLike,
    isRegExpLiteral,
    isRestElement,
    isStringLiteral,
    Literal,
    NumericLiteral,
    ObjectExpression,
    UnaryExpression,
} from '@babel/types';

/**
 * Supported, native value constructors.
 */
type PrimitiveConstructorName =
    | 'String'
    | 'Function'
    | 'Number'
    | 'Boolean'
    | 'Symbol'
    | 'BigInt'
    | 'Object'
    | 'Array'
    | 'RegExp'
    | 'Error';

type PrimitiveConstructor =
    | StringConstructor
    | FunctionConstructor
    | NumberConstructor
    | BooleanConstructor
    | SymbolConstructor
    | BigIntConstructor
    | ObjectConstructor
    | ArrayConstructor
    | RegExpConstructor
    | ErrorConstructor;

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

const isPrimitiveConstructor = (str: string): str is PrimitiveConstructorName =>
    primitiveConstructors.has(str as PrimitiveConstructorName);

enum PatternType {
    /** Predicate function applied to the input. */
    Guard = 'Guard',
    /** Instance of a primitive value. Interacts with PrimitiveConstructor. */
    Literal = 'Literal',
    /** Array literals. */
    Array = 'Array',
    /** Plain JavaScript objects. */
    Object = 'Object',
    /** Desired type, like Number. */
    Typed = 'Typed',
    /** Desired type, like Fruit. */
    CustomTyped = 'CustomTyped',
    /** No restrictions on allowed data. */
    Any = 'Any',
    /** RegExp testing against strings. */
    RegExp = 'RegExp',
}

interface BasePattern {
    type: PatternType;
}

/** Can this pattern be negated? */
interface PatternNegation {
    negated: boolean;
}

interface ArrayPattern extends BasePattern {
    type: PatternType.Array;
    value: ArrayExpression['elements'];
}

interface ObjectPattern extends BasePattern {
    type: PatternType.Object;
    value: ObjectExpression['properties'];
}

/** `value` comes from `branch` :: (arg: unknown) => boolean */
interface GuardPattern extends BasePattern {
    type: PatternType.Guard;
}

interface LiteralPattern extends BasePattern, PatternNegation {
    type: PatternType.Literal;
    /**
     * Data that is not an object and has no methods.
     * A primitive instance.
     */
    value: string | number | boolean | null | undefined | symbol | bigint;
    negated: boolean;
}

interface TypedPattern extends BasePattern, PatternNegation {
    type: PatternType.Typed;
    value: PrimitiveConstructorName;
    negated: boolean;
}

interface CustomTypedPattern extends BasePattern, PatternNegation {
    type: PatternType.CustomTyped;
    /**
     * The name of the desired type.
     *
     * @example (x = Vehicle) => {}
     */
    value: string;
    negated: boolean;
}

interface RegExpPattern extends BasePattern {
    type: PatternType.RegExp;
    value: RegExp;
}

interface AnyPattern extends BasePattern {
    type: PatternType.Any;
}

type Pattern =
    | GuardPattern
    | LiteralPattern
    | TypedPattern
    | CustomTypedPattern
    | ArrayPattern
    | ObjectPattern
    | RegExpPattern
    | AnyPattern;

const Pattern = {
    any(): AnyPattern {
        return { type: PatternType.Any };
    },

    fromPattern(node: Expression): Pattern[] {
        if (Pattern.isUnion(node)) {
            return Pattern.fromUnion(node);
        }
        return [Pattern.fromUnary(node)];
    },

    /**
     * Convert a known union of patterns into an array of them.
     */
    fromUnion(node: BinaryExpression): Pattern[] {
        const result = [Pattern.fromUnary(node.right)];
        if (Pattern.isUnion(node.left)) {
            result.push(...Pattern.fromUnion(node.left));
        } else {
            result.push(Pattern.fromUnary(node.left));
        }
        return result;
    },

    fromUnary(node: Expression): Pattern {
        if (node.type === 'UnaryExpression' && node.operator === '!') {
            return Pattern.from(node.argument, true);
        }
        return Pattern.from(node, false);
    },

    /**
     * Transform the given shape into a pattern.
     *
     * @param node The parameter default value of a given branch
     */
    from(node: Expression, isNegated: boolean): Pattern {
        if (Pattern.isTypedPattern(node)) {
            const assertedType = node.name;
            return {
                value: assertedType,
                type: PatternType.Typed,
                negated: isNegated,
            };
        }
        if (Pattern.isCustomTypedPattern(node)) {
            const assertedType = node.name;
            return {
                type: PatternType.CustomTyped,
                value: assertedType,
                negated: isNegated,
            };
        }
        if (
            isStringLiteral(node) ||
            isNumericLiteral(node) ||
            isBooleanLiteral(node) ||
            isBigIntLiteral(node)
        ) {
            return {
                value: node.value,
                type: PatternType.Literal,
                negated: isNegated,
            };
        }
        if (isRegExpLiteral(node)) {
            return {
                value: RegExp(node.pattern),
                type: PatternType.RegExp,
            };
        }
        if (Pattern.isSignedNumber(node)) {
            const isNegativeNumber = node.operator === '-';
            const desired = node.argument.value;
            return {
                type: PatternType.Literal,
                value: isNegativeNumber ? -desired : desired,
                negated: isNegated,
            };
        }
        if (Pattern.isNumberOtherwise(node)) {
            throw Error('Unimplemented');
        }
        if (isNullLiteral(node)) {
            return {
                value: null,
                type: PatternType.Literal,
                negated: isNegated,
            };
        }
        if (Pattern.isUndefinedLiteral(node)) {
            return {
                value: undefined,
                type: PatternType.Literal,
                negated: isNegated,
            };
        }
        if (Pattern.isGuardPattern(node)) {
            return {
                type: PatternType.Guard,
            };
        }
        if (isObjectExpression(node)) {
            if (isNegated) {
                throw SyntaxError('Invariant: Cannot negate object patterns');
            }
            return {
                type: PatternType.Object,
                value: node.properties, // XXX
            };
        }
        if (isArrayExpression(node)) {
            return {
                type: PatternType.Array,
                value: node.elements,
            };
        }
        throw Error('Unhandled node state');
    },

    /**
     * Handles patterns not covered by `isNumericLiteral` (excluding NaN, Infinity).
     * - Include cases like negative instances `-42`
     */
    isSignedNumber(
        node: Expression
    ): node is UnaryExpression & { argument: NumericLiteral; operator: '+' | '-' } {
        if (node.type === 'UnaryExpression' && node.prefix) {
            if (node.operator === '-' || node.operator === '+') {
                return isNumericLiteral(node.argument);
            }
        }
        return false;
    },

    /**
     * For awkward JavaScript numbers like NaN and Infinity
     */
    isNumberOtherwise(node: Expression): node is Identifier {
        if (node.type === 'Identifier') {
            if (node.name === 'Infinity') return true;
            // TODO NaN
            // - Should Number pattern match NaN arg?
        }
        return false;
    },

    isUndefinedLiteral(node: Expression): node is Literal {
        if (node.type === 'UnaryExpression' && node.operator === 'void') {
            throw Error('Invariant: `void` is not supported.');
        }
        return node.type === 'Identifier' && node.name === 'undefined';
    },

    /**
     * Is this pattern a union of patterns?
     */
    isUnion(node: Expression): node is BinaryExpression {
        return node.type === 'BinaryExpression' && node.operator === '|';
    },

    /**
     * Validates a known type.
     *
     * @example
     * // node: String
     * wavematch('foo')(
     *   (x = String) => {},
     * )
     */
    isTypedPattern(node: Expression): node is Identifier & { name: PrimitiveConstructorName } {
        if (node.type !== 'Identifier') return false;
        return isPrimitiveConstructor(node.name);
    },

    /**
     * Validates a unknown type.
     *
     * @example
     * // node: Fruit
     * class Fruit {}
     * wavematch(new Fruit())(
     *   (x = Fruit) => {},
     * )
     */
    isCustomTypedPattern(node: Expression): node is Identifier {
        return node.type === 'Identifier' && isUpperFirst(node.name);
    },

    /**
     * Validates behavior.
     *
     * @see PatternType.Guard
     * @example
     * // node: _ => _.length > 3
     * wavematch('foo')(
     *   (x = _ => _.length > 3) => {},
     * )
     */
    isGuardPattern(node: Expression): boolean {
        if (!isArrowFunctionExpression(node)) return false;
        if (node.params.length !== 1) {
            throw Error(`Guard pattern expects one argument, received ${node.params.length}.`);
        }
        return true;
    },
};

/**
 * Check if something is a plain JS object. Returns false for class
 * instances, `Object.create(null)`, arrays, and null.
 */
const isPlainObject = <K extends string | number | symbol, V>(
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
const isUpperFirst = (str: string): boolean => str[0] === str[0].toUpperCase();

/**
 * Is the branch at the given index a match given how the input data fits (or
 * does not fit) the structural patterns within it?
 *
 * @param args The input data to match against
 * @param branches The possible logical code paths
 * @param branchIndex The position of the branch to evaluate
 */
const isMatch = (args: unknown[], branches: Function[], branchIndex: number): boolean => {
    const branchCode = branches[branchIndex].toString();
    const parsed = babelParse(branchCode, { strictMode: true });
    if (!isArrowFunctionExpression(parsed)) throw TypeError('Expected an arrow function.');
    if (args.length !== parsed.params.length) return false;
    return args.every((arg, index) => {
        const [all] = Array(parsed.params[index]).map(node => {
            switch (node.type) {
                case 'AssignmentPattern':
                    return Pattern.fromPattern(node.right);
                case 'Identifier':
                    return [Pattern.any()];
                case 'ArrayPattern':
                case 'ObjectPattern':
                case 'RestElement':
                case 'TSParameterProperty':
                    throw Error(`Unimplemented: ${node.type}`);
                default:
                    throw TypeError(`Unreachable: ${node}`);
            }
        });
        return all.some(pattern => determineMatch(pattern, arg));
    });
};

const determineMatch = (pattern: Pattern, arg: unknown): boolean => {
    switch (pattern.type) {
        case PatternType.Any:
            return true;
        case PatternType.Literal:
            const isSameShape = Object.is(pattern.value, arg);
            return pattern.negated ? !isSameShape : isSameShape;
        case PatternType.RegExp:
            if (typeof arg === 'string') return pattern.value.test(arg);
            return false;
        case PatternType.Typed:
            const desiredType: PrimitiveConstructorName = pattern.value;
            const argIsDesiredType =
                primitiveConstructors.has(desiredType) &&
                Object.prototype.toString.call(arg) === `[object ${desiredType}]`;
            return pattern.negated ? !argIsDesiredType : argIsDesiredType;
        case PatternType.CustomTyped:
            if (!(typeof arg === 'object' && arg !== null)) return false;
            const acceptedTypes: string[] = [];
            let proto = Object.getPrototypeOf(arg);
            while (proto !== null) {
                const { constructor } = proto;
                if (constructor === Object) break;
                if (constructor.name !== '') acceptedTypes.push(constructor.name);
                proto = Object.getPrototypeOf(proto);
            }
            const isAcceptedType = acceptedTypes.includes(pattern.value);
            return pattern.negated ? !isAcceptedType : isAcceptedType;
        case PatternType.Array:
            if (!Array.isArray(arg)) return false;
            if (pattern.value.length !== arg.length) return false;
            return arg.every((value, index) => {
                const node = pattern.value[index];
                if (node === null) throw Error('Unreachable');
                if (node.type === 'SpreadElement') throw Error('Unimplemented');
                return determineMatch(Pattern.fromUnary(node), value);
            });
        case PatternType.Object:
            if (!isPlainObject(arg)) return false;
            const tuples = pattern.value.map<[string, Pattern[]]>(node => {
                if (node.type === 'SpreadElement') {
                    throw SyntaxError('SpreadElement is unsupported.');
                } else if (node.type === 'ObjectMethod') {
                    throw SyntaxError('Object methods are unsupported.');
                }
                if (node.value.type === 'Identifier') {
                    const { name } = node.value;
                    if (!(name === 'null' || name === 'undefined') && !isUpperFirst(name)) {
                        throw SyntaxError('Cannot use shorthand syntax or variables as values.');
                    }
                }
                if (isRestElement(node.value)) throw Error('Unimplemented'); // Can this happen?
                if (isPatternLike(node.value) && !isIdentifier(node.value)) {
                    throw Error('Unimplemented');
                }
                if (node.computed) throw SyntaxError('Computed keys are unsupported.');
                // XXX @babel/types.ObjectProperty.key is `any`
                const key: unknown = node.key; // key: computed ? Expression : (Identifier | Literal)
                if (!(typeof key === 'object' && key !== null)) throw TypeError('Unreachable');
                if (!isIdentifier(key)) {
                    throw SyntaxError('Invariant: key must be an Identifier.');
                }
                if (typeof key.name !== 'string') throw TypeError('Unreachable');
                return [key.name, Pattern.fromPattern(node.value)];
            });
            return tuples.every(([key, ps]) => ps.some(p => determineMatch(p, arg[key])));
        case PatternType.Guard:
            // const guard: unknown = eval(branchCode);
            // if (typeof guard !== 'function') throw TypeError(`Unreachable: ${guard}`);
            // if (guard.length !== 1) {
            //     throw TypeError('Invariant: Guard must take one argument.');
            // }
            // const result: unknown = guard(arg);
            // if (typeof result !== 'boolean') {
            //     throw TypeError('Invariant: Guard must return true/false.');
            // }
            // return result;
            throw Error('Unimplemented');
        default:
            throw Error(`Unreachable: ${pattern}`);
    }
};

/**
 * Evaluate the first branch with patterns successfully matching the given
 * arguments.
 *
 * > A control flow mechanism; for each given branch, each default argument
 * value constitutes a special pattern describing the kind of input data the
 * corresponding function body expects.
 */
export const wavematch = (...args: unknown[]) =>
    /**
     * - Order matters; a branch matching on `String` will match over `'foo'`
     */
    (...branches: Function[]): unknown => {
        if (args.length === 0) throw Error('Invariant: No data');
        if (branches.length === 0) throw Error('Invariant: No branches');
        for (let index = 0; index < branches.length; index++) {
            if (isMatch(args, branches, index)) {
                const branch = branches[index];
                /**
                 * TODO Erase the default parameters from `branch`.
                 */
                return branch(...args);
            }
        }
        return branches[branches.length - 1].call(null);
    };
