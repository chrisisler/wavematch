import { parseExpression as quote } from '@babel/parser';
import {
    ArrayPattern,
    ArrowFunctionExpression,
    AssignmentPattern,
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
    ObjectMethod,
    ObjectPattern,
    ObjectProperty,
    SpreadElement,
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

const isKnownConstructor = (str: string): str is PrimitiveConstructorName =>
    primitiveConstructors.has(str as PrimitiveConstructorName);

enum PatternType {
    /** Instance of a primitive value. Interacts with PrimitiveConstructor. */
    Literal = 'Literal',
    /** Array literals. */
    Array = 'Array',
    /** Plain JavaScript objects. */
    Object = 'Object',
    /** Desired type, like Number. */
    Typed = 'Typed',
    /** Desired type, like Fruit. */
    ClassTyped = 'ClassTyped',
    /** No restrictions on allowed data. */
    Any = 'Any',
    /** RegExp testing against strings. */
    RegExp = 'RegExp',
}

/**
 * The below is an example of a pattern. A pattern consists of a left and a
 * right. The left side of may be destructured or it may not. The right side
 * may exist or it may not.
 *
 * @example (left = right) => {}
 * @see Pattern
 */
interface PatternBase {
    type: PatternType;
}

/** Can this pattern be negated? */
interface PatternNegation {
    negated: boolean;
}

interface PatternArray extends PatternBase {
    type: PatternType.Array;
    /**
     * If `elements` is null, then `requiredSize` is not null.
     */
    elements: null | (null | Expression | SpreadElement)[];
    /**
     * Exists if a branch destructures an array input.
     */
    requiredSize: null | number;
}

interface PatternObject extends PatternBase {
    type: PatternType.Object;
    properties: null | (ObjectMethod | ObjectProperty | SpreadElement)[];
    requiredKeys: null | string[];
}

interface PatternLiteral extends PatternBase, PatternNegation {
    type: PatternType.Literal;
    /**
     * Data that is not an object and has no methods.
     * A primitive instance.
     */
    value: string | number | boolean | null | undefined | symbol | bigint;
    negated: boolean;
}

interface PatternTyped extends PatternBase, PatternNegation {
    type: PatternType.Typed;
    desiredType: PrimitiveConstructorName;
    negated: boolean;
}

interface PatternClassTyped extends PatternBase, PatternNegation {
    type: PatternType.ClassTyped;
    className: string;
    negated: boolean;
}

interface PatternRegExp extends PatternBase {
    type: PatternType.RegExp;
    regExp: RegExp;
}

interface PatternAny extends PatternBase {
    type: PatternType.Any;
}

type Pattern =
    | PatternLiteral
    | PatternTyped
    | PatternClassTyped
    | PatternArray
    | PatternObject
    | PatternRegExp
    | PatternAny;

const Pattern = {
    any(): PatternAny {
        return { type: PatternType.Any };
    },

    // Caller must guarantee that either `value` is provided or `requiredSize`
    // is provided; otherwise things will break.
    array({
        elements = null,
        requiredSize = null,
    }: Partial<Omit<PatternArray, 'type'>>): PatternArray {
        return {
            elements,
            requiredSize,
            type: PatternType.Array,
        };
    },

    // Caller must guarantee that either `properties` is provided or
    // `requiredKeys` is provided; otherwise things will break.
    object({
        properties = null,
        requiredKeys = null,
    }: Partial<Omit<PatternObject, 'type'>>): PatternObject {
        return {
            type: PatternType.Object,
            properties,
            requiredKeys,
        };
    },

    from(node: AssignmentPattern | Expression): Pattern[] {
        let nodes: Expression[];
        if (node.type === 'AssignmentPattern') {
            nodes = Pattern.isUnion(node.right) ? Pattern.extractUnion(node.right) : [node.right];
            // Left side of pattern only matters if the param node uses array/object
            // destructuring
            const left =
                node.left.type === 'ArrayPattern' || node.left.type === 'ObjectPattern'
                    ? node.left
                    : undefined;
            return nodes.map(right => Pattern.fromUnary(right, left));
        }
        nodes = Pattern.isUnion(node) ? Pattern.extractUnion(node) : [node];
        return nodes.map(right => Pattern.fromUnary(right));
    },

    extractUnion(node: BinaryExpression): Expression[] {
        const nodes = [node.right];
        if (Pattern.isUnion(node.left)) {
            nodes.push(...Pattern.extractUnion(node.left));
        } else {
            nodes.push(node.left);
        }
        return nodes;
    },

    /**
     * Classify the given node into a Pattern based on the node's shape.
     */
    fromUnary(right: Expression, destructured?: ArrayPattern | ObjectPattern): Pattern {
        const [node, isNegated] = Pattern.isNegated(right)
            ? [right.argument, true]
            : [right, false];
        const requiredSize =
            destructured?.type === 'ArrayPattern' ? destructured.elements.length : undefined;
        if (isArrayExpression(node)) {
            return Pattern.array({
                elements: node.elements,
                requiredSize,
            });
        }
        if (requiredSize !== undefined) {
            if (Pattern.isTypedPattern(node)) {
                console.warn('Warning: Unnecessary Array type pattern');
                // Act like `([]) => {}`
                return Pattern.array({ requiredSize });
            }
            throw SyntaxError('Invariant: Invalid array-destructuring pattern');
        }
        if (isObjectExpression(node)) {
            if (isNegated) throw SyntaxError('Invariant: Cannot negate object patterns');
            return Pattern.object({
                properties: node.properties,
            });
        }
        if (Pattern.isTypedPattern(node)) {
            return {
                desiredType: node.name,
                type: PatternType.Typed,
                negated: isNegated,
            };
        }
        if (Pattern.isClassTypedPattern(node)) {
            return {
                type: PatternType.ClassTyped,
                className: node.name,
                negated: isNegated,
            };
        }
        // PatternType.Literal cases
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
                regExp: RegExp(node.pattern),
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
        throw Error('Unhandled node state');
    },

    /**
     * @see fits
     */
    // Issue within the @babel/types package: ObjectProperty.key should not be `any`
    // but instead ObjectProperty.computed ? Expression : (Identifier | Literal)
    validateKey(key: unknown): key is Identifier & { name: string } {
        if (!(typeof key === 'object' && key !== null)) return Unreachable();
        if (!isIdentifier(key)) throw SyntaxError('Key must be an Identifier.');
        if (typeof key.name !== 'string') return Unreachable();
        return true;
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
            // - Should Number pattern match NaN arg? No.
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
    isUnion(node: Expression): node is BinaryExpression & { operator: '|' } {
        return node.type === 'BinaryExpression' && node.operator === '|';
    },

    /**
     * @see PatternNegation
     */
    isNegated(node: Expression): node is UnaryExpression & { operator: '!' } {
        return node.type === 'UnaryExpression' && node.operator === '!';
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
        return isKnownConstructor(node.name);
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
    isClassTypedPattern(node: Expression): node is Identifier {
        return node.type === 'Identifier' && isUpperFirst(node.name);
    },
};

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
const Unreachable = (data?: unknown): never => {
    if (data !== undefined && data !== null) {
        throw TypeError(`Unreachable: ${data}`);
    }
    throw TypeError('Unreachable');
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

const flatMap = <T, Result>(
    array: T[],
    fn: (value: T, index: number, array: T[]) => Result[]
): Result[] => ([] as Result[]).concat(...array.map(fn));

const hasProperty = Function.call.bind(Object.prototype.hasOwnProperty);

/**
 * Maps a branch parameter into its patterns.
 */
const branchParamToPatterns = (
    node: ArrowFunctionExpression['params'] extends (infer P)[] ? P : never
): Pattern[] => {
    switch (node.type) {
        case 'Identifier': // (foo) => {}
            return [Pattern.any()];
        case 'ObjectPattern': // (x = {}) => {}
            const requiredKeys = flatMap(node.properties, (prop): string[] =>
                // XXX @babel/types ObjectProperty.key
                prop.type === 'ObjectProperty' ? [prop.key.name] : []
            );
            return [Pattern.object({ requiredKeys })];
        case 'ArrayPattern': // (x = []) => {}
            return [Pattern.array({ requiredSize: node.elements.length })];
        case 'AssignmentPattern': // (x = ???) => {}
            return Pattern.from(node);
        case 'RestElement': // (...x) => {}
        case 'TSParameterProperty':
            throw Error('Unimplemented');
        default:
            return Unreachable(node);
    }
};

const doesMatch = (args: unknown[], branches: Function[], branchIndex: number): boolean => {
    const ast = quote(branches[branchIndex].toString());
    if (!isArrowFunctionExpression(ast)) throw TypeError('Expected an arrow function.');
    if (args.length !== ast.params.length) return false;
    return args.every((arg, index) =>
        branchParamToPatterns(ast.params[index]).some(pattern => fits(arg, pattern))
    );
};

const fits = (arg: unknown, pattern: Pattern): boolean => {
    switch (pattern.type) {
        case PatternType.Any:
            return true;
        case PatternType.Literal:
            const isSameShape = Object.is(pattern.value, arg);
            return pattern.negated ? !isSameShape : isSameShape;
        case PatternType.RegExp:
            if (typeof arg === 'string') return pattern.regExp.test(arg);
            return false;
        case PatternType.Typed:
            if (pattern.desiredType === 'Object' && !isPlainObject(arg)) return false;
            const argIsDesiredType =
                isKnownConstructor(pattern.desiredType) &&
                Object.prototype.toString.call(arg) === `[object ${pattern.desiredType}]`;
            return pattern.negated ? !argIsDesiredType : argIsDesiredType;
        case PatternType.ClassTyped:
            if (!(typeof arg === 'object' && arg !== null)) return false;
            const acceptedTypes: string[] = [];
            let proto = Object.getPrototypeOf(arg);
            // Collect the constructors `arg` inherits from
            while (proto !== null) {
                if (proto.constructor === Object) break;
                if (proto.constructor.name !== '') acceptedTypes.push(proto.constructor.name);
                proto = Object.getPrototypeOf(proto);
            }
            const isAcceptedType = acceptedTypes.includes(pattern.className);
            return pattern.negated ? !isAcceptedType : isAcceptedType;
        case PatternType.Array:
            if (!Array.isArray(arg)) return false;
            const patternElements = pattern.elements;
            if (patternElements === null) {
                if (pattern.requiredSize === null) return Unreachable();
                return pattern.requiredSize <= arg.length;
            }
            if (patternElements.length !== arg.length) return false;
            return arg.every((value, index) => {
                const node = patternElements[index];
                if (node === null) return Unreachable();
                if (node.type === 'SpreadElement') throw TypeError('Unimplemented');
                return fits(value, Pattern.fromUnary(node));
            });
        case PatternType.Object:
            if (!isPlainObject(arg)) return false;
            if (!!pattern.requiredKeys) {
                const argSize = Object.keys(arg).length;
                const patternSize = pattern.requiredKeys.length;
                if (patternSize === 0) return argSize === 0;
                if (patternSize > argSize) return false;
                if (!pattern.requiredKeys.every(requiredKey => hasProperty(arg, requiredKey))) {
                    return false;
                }
            }
            if (pattern.properties === null) return true;
            return pattern.properties.every(node => {
                // node.type
                if (node.type === 'SpreadElement') {
                    throw SyntaxError('SpreadElement is unsupported.');
                } else if (node.type === 'ObjectMethod') {
                    throw SyntaxError('Object methods are unsupported.');
                }
                // node.value
                if (node.value.type === 'Identifier') {
                    const { name } = node.value;
                    if (!(name === 'null' || name === 'undefined') && !isUpperFirst(name)) {
                        throw SyntaxError('Cannot use shorthand syntax.');
                    }
                }
                if (isRestElement(node.value)) throw Error('Unimplemented');
                if (isPatternLike(node.value) && !isIdentifier(node.value)) {
                    throw Error('Unimplemented');
                }
                // node.key
                if (node.computed) throw SyntaxError('Computed keys are unsupported.');
                if (!Pattern.validateKey(node.key)) return Unreachable(node.key);
                return Pattern.from(node.value).some(subPattern =>
                    fits(arg[node.key.name], subPattern)
                );
            });
        default:
            return Unreachable(pattern);
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
export const wavematch = (...args: unknown[]) => (...branches: Function[]): unknown => {
    if (args.length === 0) throw Error('Invariant: No data');
    if (branches.length === 0) throw Error('Invariant: No branches');
    for (let index = 0; index < branches.length; index++) {
        if (doesMatch(args, branches, index)) {
            const branch = branches[index];
            return branch(...args);
        }
    }
    return branches[branches.length - 1].call(void 0);
};
