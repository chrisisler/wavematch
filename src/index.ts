import { parseExpression as quote } from '@babel/parser';
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

    /**
     * Maps a branch parameter into its patterns.
     */
    fromBranchArgument(
        node:
            | AssignmentPattern
            | Identifier
            | ObjectPattern
            | ArrayPattern
            | RestElement
            | TSParameterProperty
    ): Pattern[] {
        switch (node.type) {
            case 'Identifier': // (foo) => {}
                return [Pattern.any()];
            case 'ObjectPattern': // (x = {}) => {}
                const requiredKeys = node.properties.flatMap((prop): string[] =>
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
    },

    extractUnion(node: BinaryExpression): Expression[] {
        const nodes = [node.right];
        if (Pattern.isUnion(node.left)) {
            nodes.push.apply(nodes, Pattern.extractUnion(node.left));
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
        // console.log('node is:', node);
        // Check for guards:
        // if (node.type === 'ArrowFunctionExpression')
        throw Error('Unhandled node state');
    },

    /**
     * @see Pattern.fits
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

    /**
     * Check if the provided argument fits the structure/data described by given
     * pattern.
     *
     * Contains rules for matching against every kind of accepted pattern.
     */
    fits(arg: unknown, pattern: Pattern): boolean {
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
                    return pattern.requiredSize === arg.length;
                }
                if (patternElements.length !== arg.length) return false;
                return arg.every((value, index) => {
                    const node = patternElements[index];
                    if (node === null) return Unreachable();
                    if (node.type === 'SpreadElement') throw TypeError('Unimplemented');
                    return Pattern.from(node).some(subPattern => Pattern.fits(value, subPattern));
                    // return Pattern.fits(value, Pattern.fromUnary(node));
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
                    return Pattern.from(node.value).some(subPattern =>
                        Pattern.fits(arg[node.key.name], subPattern)
                    );
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
            default:
                return Unreachable(`Unhandled pattern type: ${JSON.stringify(pattern)}`);
        }
    },
};

const doesMatch = (args: readonly unknown[], branch: Function): boolean => {
    const ast = quote(branch.toString());
    if (!isArrowFunctionExpression(ast)) {
        throw TypeError(`Expected an arrow function. Received: ${ast}`);
    }
    // Only match against branches that take the same number of inputs
    if (args.length !== ast.params.length) {
        return false;
    }
    // True if each arg fits the pattern provided by the `branch` parameter at that index
    return args.every((arg, index) => {
        const branchParam = ast.params[index];
        const patterns = Pattern.fromBranchArgument(branchParam);
        return patterns.some(pattern => Pattern.fits(arg, pattern));
    });
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
    // @ts-ignore
    return branches[branches.length - 1]();
};

function isIdentifierNegativeInfinity(_: CallExpression['arguments'][number]): boolean {
    return _.type === 'UnaryExpression' && _.operator === '-' && isIdentifierInfinity(_.argument);
}

function isIdentifierInfinity(_: CallExpression['arguments'][number]): _ is Identifier {
    return _.type === 'Identifier' && _.name === 'Infinity';
}
