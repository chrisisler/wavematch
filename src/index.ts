import generate from '@babel/generator';
import { parseExpression } from '@babel/parser';
import {
    ArrayPattern,
    AssignmentPattern,
    BinaryExpression,
    CallExpression,
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
    ObjectPattern,
    RestElement,
    TSParameterProperty,
    UnaryExpression,
} from '@babel/types';

import {
    Pattern,
    PatternAny,
    PatternArray,
    PatternObject,
    PatternType,
    PrimitiveConstructorName,
} from './interfaces';
import { hasProperty, isKnownConstructor, isPlainObject, isUpperFirst, Unreachable } from './util';

/**
 * Namespace for functions which create Patterns.
 */
// eslint-disable-next-line no-redeclare
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
        // @ts-ignore
        return {
            elements,
            requiredSize,
            type: PatternType.Array,
        };
    },

    // Caller must guarantee that either `properties` is provided or
    // `requiredKeys` is provided; otherwise things will break.
    object({
        properties = undefined,
        requiredKeys = undefined,
    }: Partial<Omit<PatternObject, 'type'>>): PatternObject {
        return {
            type: PatternType.Object,
            properties,
            requiredKeys,
        };
    },

    /**
     * Wraps `fromUnary` for each pattern extracted from `node`.
     */
    from(node: AssignmentPattern | Expression): Pattern[] {
        if (node.type === 'AssignmentPattern') {
            const { left, right } = node;
            const rightNodes = Pattern.isUnion(right) ? Pattern.extractUnion(right) : [right];
            // Left side only matters if the param uses array/object destructuring `([] = []) =>`
            const leftMaybe =
                left.type === 'ArrayPattern' || left.type === 'ObjectPattern' ? left : undefined;
            return rightNodes.map(rightNode => Pattern.fromUnary(rightNode, leftMaybe));
        }
        const nodes = Pattern.isUnion(node) ? Pattern.extractUnion(node) : [node];
        return nodes.map(right => Pattern.fromUnary(right));
    },

    /**
     * Given the ast node for some argument that a branch function takes,
     * return the patterns that should be used to match that argument.
     */
    fromBranchParam(
        node:
            | AssignmentPattern
            | Identifier
            | ObjectPattern
            | ArrayPattern
            | RestElement
            | TSParameterProperty
    ): Pattern[] {
        switch (node.type) {
            // (foo) => {}
            case 'Identifier':
                return [Pattern.any()];
            // (x = {}) => {}
            case 'ObjectPattern':
                const requiredKeys = node.properties.flatMap((prop): string[] =>
                    // XXX @babel/types ObjectProperty.key
                    prop.type === 'ObjectProperty' ? [prop.key.name] : []
                );
                return [Pattern.object({ requiredKeys })];
            // (x = []) => {}
            case 'ArrayPattern':
                return [Pattern.array({ requiredSize: node.elements.length })];
            // (x = ???) => {}
            case 'AssignmentPattern':
                return Pattern.from(node);
            // (...x) => {}
            case 'RestElement':
            case 'TSParameterProperty':
                throw Error('Unimplemented');
            default:
                return Unreachable(node);
        }
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
        if (Pattern.isNumberRange(node)) {
            const [low, high] = node.arguments.map(_ => {
                // Positive number
                if (_.type === 'NumericLiteral') return _.value;
                // Negative number
                if (_.type === 'UnaryExpression' && _.argument.type === 'NumericLiteral') {
                    return -_.argument.value;
                }
                // Infinity
                if (isIdentifierInfinity(_)) {
                    return Infinity;
                }
                // -Infinity
                if (isIdentifierNegativeInfinity(_)) {
                    return -Infinity;
                }
                throw TypeError(`Expected a numeric literal. Received: ${JSON.stringify(_)}`);
            });
            return {
                type: PatternType.NumberRange,
                low,
                high,
            };
        }
        if (isArrowFunctionExpression(node)) {
            if (node.params.length !== 1) {
                throw SyntaxError('Guards must have exactly one parameter.');
            }
            const { code } = generate(node, {}, '');
            const guard = new Function('return ' + code)();
            if (typeof guard !== 'function') return Unreachable();
            return {
                type: PatternType.Guard,
                guard,
            };
        }
        throw Error('Unhandled node state');
    },

    /**
     * @see Pattern.matches
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

    isNumberRange(node: Expression): node is CallExpression {
        if (node.type === 'CallExpression' && node.arguments.length === 2) {
            // A regular number instance or a negative number or Infinity or Negative Infinity
            const validNumbers = node.arguments.every(
                _ =>
                    _.type === 'NumericLiteral' ||
                    (_.type === 'UnaryExpression' && _.argument.type === 'NumericLiteral') ||
                    isIdentifierInfinity(_) ||
                    isIdentifierNegativeInfinity(_)
            );
            if (validNumbers) {
                return true;
            }
        }
        return false;
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
     * Validates an unknown type.
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

    /**
     * Scrutinizes the provided argument based on whether it fits the
     * structure/data described by given pattern.
     *
     * Contains rules for matching against every kind of accepted pattern.
     */
    matches(arg: unknown, pattern: Pattern): boolean {
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
                if (pattern.elements === null) {
                    if (pattern.requiredSize === null) return Unreachable();
                    return pattern.requiredSize === arg.length;
                }
                if (pattern.elements.length !== arg.length) return false;
                return arg.every((value, index) => {
                    const node: typeof pattern.elements[number] = pattern.elements[index];
                    if (node === null) return Unreachable();
                    if (node.type === 'SpreadElement') throw TypeError('Unimplemented');
                    return Pattern.from(node).some(p => Pattern.matches(value, p));
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
                if (pattern.properties === undefined) return true;
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
                    const value = arg[node.key.name];
                    return Pattern.from(node.value).some(p => Pattern.matches(value, p));
                });
            case PatternType.NumberRange:
                if (typeof arg !== 'number') return false;
                const { low, high } = pattern;
                if (low >= high) {
                    throw RangeError('Expected a valid range. Received an invalid range.');
                }
                if (low <= arg && high >= arg) {
                    return true;
                }
                return false;
            case PatternType.Guard:
                const res = pattern.guard(arg);
                if (typeof res === 'boolean') return res;
                throw TypeError('Guard patterns must return a boolean.');
            default:
                return Unreachable(`Unhandled pattern type: ${JSON.stringify(pattern)}`);
        }
    },
};

const doesMatch = (args: readonly unknown[], branch: Function): boolean => {
    const ast = parseExpression(branch.toString(), {
        // TODO?
        // plugins: ['typescript'],
    });
    if (!isArrowFunctionExpression(ast)) {
        throw TypeError(`Expected an arrow function. Received: ${ast}`);
    }
    // Only match branches that take the same number of inputs
    if (args.length !== ast.params.length) {
        return false;
    }
    return args.every((arg, index) =>
        Pattern.fromBranchParam(ast.params[index]).some(p => Pattern.matches(arg, p))
    );
};

/**
 * Evaluate the first branch whose patterns successfully match the provided
 * arguments.
 *
 * Wavematch is a control flow mechanism, almost like a new keyword. For each
 * given branch, each default argument constitutes a special pattern describing
 * the kind of input data that branch expects.
 */
export const wavematch = (...args: unknown[]) => <U>(...branches: ((...xs: any[]) => U)[]): U => {
    if (args.length === 0) throw Error('Invariant: No data');
    if (branches.length === 0) throw Error('Invariant: No branches');
    for (let index = 0; index < branches.length; index++) {
        const branch = branches[index];
        if (doesMatch(args, branch)) {
            return branch(...args);
        }
    }
    // Return the last branch, assumed to be the default behavior
    return branches[branches.length - 1]();
};

function isIdentifierNegativeInfinity(_: CallExpression['arguments'][number]): boolean {
    return _.type === 'UnaryExpression' && _.operator === '-' && isIdentifierInfinity(_.argument);
}

function isIdentifierInfinity(_: CallExpression['arguments'][number]): _ is Identifier {
    return _.type === 'Identifier' && _.name === 'Infinity';
}
