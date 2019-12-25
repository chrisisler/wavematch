/**
 * Notes
 * - Cannot access body of a branch.
 * - Do not offer a wavematch.create api
 *
 * Questions
 * - When unacceptable syntax is encountered, error or warn?
 */

import { parseExpression as babelParse } from '@babel/parser';
import {
    BinaryExpression,
    Expression,
    isArrowFunctionExpression,
    isBigIntLiteral,
    isBooleanLiteral,
    isNullLiteral,
    isNumberLiteral,
    isStringLiteral,
} from '@babel/types';

/**
 * Data that is not an object and has no methods.
 * A primitive instance.
 */
type LiteralInstance =
    | string
    | number
    | boolean
    | null
    | undefined
    | symbol
    | bigint;

/**
 * All primitive values have object equivalents that wrap around the primitive
 * values.
 */
type PrimitiveWrapper =
    | 'String'
    | 'Number'
    | 'Boolean'
    | 'Symbol'
    | 'BigInt'
    | 'Object'
    | 'Array'
    | 'RegExp'
    | 'Error';

const primitiveWrappers: PrimitiveWrapper[] = [
    'String',
    'Number',
    'Boolean',
    'Symbol',
    'BigInt',
    'Object',
    'Array',
    'RegExp',
    'Error',
];

interface GuardPattern {
    value(arg: unknown): boolean;
}

interface LiteralPattern {
    value: LiteralInstance;
}

interface TypeCheckPattern {
    value: PrimitiveWrapper;
}

/**
 * Represents the parsed pattern.
 */
type Pattern = GuardPattern | LiteralPattern | TypeCheckPattern;

/**
 * Is `node` === `undefined`?
 *
 * Does not work for `void 0`.
 */
const isUndefinedLiteral = (node: Expression): boolean =>
    node.type === 'Identifier' && node.name === 'undefined';

const Pattern = {
    /**
     * Transform the node's value into a pattern.
     * @param node The parameter default value of a given branch
     */
    from(node: Expression): Pattern {
        if (Pattern.isLiteralPattern(node)) {
            return {
                value: 3, // XXX
            };
        }
        if (Pattern.isGuardPattern(node)) {
            return {
                value: Boolean, // XXX
            };
        }
        if (Pattern.isTypeCheckPattern(node)) {
            return {
                value: 'Boolean', // XXX
            };
        }
        // Unhandled node state
        throw Error('Unreachable');
    },

    /**
     * Validates a type-based matching "shape".
     *
     * @see PatternType.Literal
     * @example
     * wavematch(2)(
     *   (x = 3) => {},
     * )
     */
    isLiteralPattern(node: Expression): boolean {
        return (
            isStringLiteral(node) ||
            isNumberLiteral(node) ||
            isBooleanLiteral(node) ||
            isNullLiteral(node) ||
            isBigIntLiteral(node) ||
            isUndefinedLiteral(node)
        );
    },

    /**
     * Validates a type-based matching "shape".
     *
     * @see PatternType.TypeCheck
     * @example
     * wavematch('foo')(
     *   (x = String) => {},
     * )
     */
    isTypeCheckPattern(node: Expression): boolean {
        if (node.type !== 'Identifier') return false;
        /**
         * This usage of `as` exists to keep the `primitiveWrappers` definition
         * 1:1 parallel with the `PrimitiveWrapper` type that it represents.
         */
        if (primitiveWrappers.includes(node.name as PrimitiveWrapper)) {
            return true;
        }
        // XXX Custom Type Names
        return false;
    },

    /**
     * Validates a type-based matching "shape".
     *
     * @see PatternType.Guard
     * @example
     * wavematch('foo')(
     *   (x = _ => _.length > 3) => {},
     * )
     */
    isGuardPattern(node: Expression): boolean {
        if (!isArrowFunctionExpression(node)) return false;
        if (node.params.length !== 1) {
            throw Error(
                `Guard pattern expects one argument, received ${node.params.length}.`
            );
        }
        // XXX Eval and apply the guardfn
        return false;
    },

    /**
     * Is this pattern a union of patterns?
     */
    isUnion(node: Expression): node is BinaryExpression {
        return node.type === 'BinaryExpression' && node.operator === '|';
    },

    /**
     * Convert a known union of patterns into an array of them.
     */
    fromUnion(node: BinaryExpression): Pattern[] {
        const result = [Pattern.from(node.right)];
        if (Pattern.isUnion(node.left)) {
            result.push(...Pattern.fromUnion(node.left));
        } else {
            result.push(Pattern.from(node.left));
        }
        return result;
    },
};

/**
 * The parsing logic.
 *
 * Extracts the pattern OR subpatterns, and any custom types.
 */
const extractPatterns = (branch: Function): unknown[] => {
    const branchCode = branch.toString();
    const expression = babelParse(branchCode, { strictMode: true });
    if (!isArrowFunctionExpression(expression)) {
        throw TypeError('Invariant: Expected function');
    }
    if (expression.params.length === 0) {
        throw Error('Invariant: Cannot match against zero parameters');
    }
    return expression.params.map(node => {
        switch (node.type) {
            case 'ArrayPattern':
                /**
                 * Array destructure matching only
                 */
                return node;
            case 'AssignmentPattern':
                // XXX node.left will be .type ObjectPattern or ArrayPattern if
                // destructured

                /**
                 * Pattern matching
                 * May also be ArrayPattern, ObjectPattern
                 */
                if (Pattern.isUnion(node.right)) {
                    return Pattern.fromUnion(node.right);
                }
                return Pattern.from(node.right);
            case 'Identifier':
                /**
                 * No pattern provided, no destructuring.
                 * Matches anything if list doesn't contain a RestElement.
                 */
                return node;
            case 'ObjectPattern':
                /**
                 * Object destructure matching only
                 */
                return node;
            case 'RestElement':
                /**
                 * Spread arguments matching
                 * May contain position-bound Identifiers
                 */
                return node;
            case 'TSParameterProperty':
                /**
                 * Type matching ???
                 */
                return node;
            default:
                throw TypeError('Unreachable');
        }
    });
};

/**
 * Is the branch at the given index a match given how the input data fits (or
 * does not fit) the structural patterns within it?
 *
 * @param args The input data to match against
 * @param branches The possible logical code paths
 * @param branchIndex The position of the branch to evaluate
 */
const isMatch = (
    args: unknown[],
    branches: Function[],
    branchIndex: number
): boolean => {
    const branch = branches[branchIndex];
    const patterns = extractPatterns(branch);
    if (args.length !== patterns.length) return false;
    return args.every((input, position) => {
        const pattern = patterns[position];
        // XXX
        pattern;
        input;
        return false;
    });
};

/**
 * A pattern matching operator.
 *
 * Takes all data, then returns a function that takes all branches, then
 * computes and returns the result.
 *
 * @param args The input data.
 * @returns A function taking functions as arguments. For each function, every
 * default argument value constitutes a special pattern describing the kind
 * of input data the corresponding function body depends on.
 */
export const wavematch = (...args: unknown[]) =>
    /**
     * Branch functions that take a different number of arguments than
     * the wavematched function will be applied to will **not** match.
     */
    (...branches: Function[]): unknown => {
        if (args.length === 0) throw TypeError('Invariant: No data');
        if (branches.length === 0) throw TypeError('Invariant: No branches');
        for (let index = 0; index < branches.length; index++) {
            if (isMatch(args, branches, index)) {
                const branch = branches[index];
                /**
                 * XXX Erase the default paramaters from `branch`.
                 */
                return branch(...args);
            }
        }
        return 'DEFAULTED';
    };
