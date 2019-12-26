import { parseExpression as babelParse } from '@babel/parser';
import {
    BinaryExpression,
    Expression,
    Identifier,
    isArrayExpression,
    isArrowFunctionExpression,
    isBigIntLiteral,
    isBooleanLiteral,
    isNullLiteral,
    isNumericLiteral,
    isObjectExpression,
    isStringLiteral,
    Literal,
} from '@babel/types';

/**
 * Data that is not an object and has no methods.
 * A primitive instance.
 */
type LiteralInstance = string | number | boolean | null | undefined | symbol | bigint;

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

const primitiveWrappers = [
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

enum PatternType {
    /** Predicate funcition applied to the input. */
    Guard = 'Guard',
    /** Instance of a primitive value. */
    Literal = 'Literal',
    /** Desired type. */
    TypeCheck = 'TypeCheck',
    /** No restrictions on allowed data. */
    Any = 'Any',
    /** Object or array pattern. */
    Collection = 'Collection',
}

interface BasePattern {
    type: PatternType;
    value?: Exclude<unknown, null | undefined | void>;
}

interface CollectionPattern extends BasePattern {
    type: PatternType.Collection;
    value: object | unknown[];
}

interface GuardPattern extends BasePattern {
    type: PatternType.Guard;
    value(arg: unknown): boolean;
}

interface LiteralPattern extends BasePattern {
    type: PatternType.Literal;
    value: LiteralInstance;
}

interface TypeCheckPattern extends BasePattern {
    type: PatternType.TypeCheck;
    value: PrimitiveWrapper;
}

interface AnyPattern extends BasePattern {
    type: PatternType.Any;
}

type Pattern = GuardPattern | LiteralPattern | TypeCheckPattern | CollectionPattern | AnyPattern;

/**
 * Is `node` === `undefined`?
 *
 * Does not work for `void 0`.
 */
const isUndefinedLiteral = (node: Expression): node is Literal =>
    node.type === 'Identifier' && node.name === 'undefined';

const isPrimitiveWrapper = (str: string): str is PrimitiveWrapper =>
    primitiveWrappers.includes(str);

const Pattern = {
    any(): AnyPattern {
        return { type: PatternType.Any };
    },

    /**
     * Transform the node's value into a pattern.
     *
     * PatternType = Literal | Guard | TypeCheck
     *
     * @param node The parameter default value of a given branch
     */
    from(node: Expression): Pattern {
        // TypeCheck Pattern
        if (Pattern.isTypeCheckPattern(node) && isPrimitiveWrapper(node.name)) {
            return {
                value: node.name,
                type: PatternType.TypeCheck,
            };
        }
        // Guard Pattern
        if (Pattern.isGuardPattern(node)) {
            // XXX Extract guardFn
            return {
                value: Boolean,
                type: PatternType.Guard,
            };
        }
        // Literal Pattern
        if (
            isStringLiteral(node) ||
            isNumericLiteral(node) ||
            isBooleanLiteral(node) ||
            isBigIntLiteral(node)
        ) {
            return {
                value: node.value,
                type: PatternType.Literal,
            };
        }
        if (isNullLiteral(node)) {
            return {
                value: 'null',
                type: PatternType.Literal,
            };
        }
        if (isUndefinedLiteral(node)) {
            return {
                value: 'undefined',
                type: PatternType.Literal,
            };
        }
        // Object Destructuring Pattern
        if (isObjectExpression(node)) {
            // const value = recreateObject(node)
            return {
                type: PatternType.Collection,
                value: { id: 42 },
            };
        }
        // Array Destructuring Pattern
        if (isArrayExpression(node)) {
            // XXX
        }
        throw Error(`Unhandled pattern: ${node}`);
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

    /**
     * Is this pattern a union of patterns?
     */
    isUnion(node: Expression): node is BinaryExpression {
        return node.type === 'BinaryExpression' && node.operator === '|';
    },
    /**
     * Validates a known type.
     *
     * @see PatternType.TypeCheck
     * @example
     * wavematch('foo')(
     *   (x = String) => {},
     * )
     */
    isTypeCheckPattern(node: Expression): node is Identifier {
        if (node.type !== 'Identifier') return false;
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
            throw Error(`Guard pattern expects one argument, received ${node.params.length}.`);
        }
        // XXX Eval and apply the guardfn
        return false;
    },
};

/**
 * The parsing logic applied to every branch with a pattern.
 *
 * Extracts the pattern OR subpatterns, and any custom types.
 */
const createPatterns = (branch: Function): Pattern[][] => {
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
                return [Pattern.any()];
            case 'AssignmentPattern':
                /**
                 * Pattern matching
                 * May also be ArrayPattern, ObjectPattern
                 *
                 * node.left will be .type ObjectPattern or ArrayPattern if destructured
                 */
                if (Pattern.isUnion(node.right)) {
                    return Pattern.fromUnion(node.right);
                }
                return [Pattern.from(node.right)];
            case 'Identifier':
                /**
                 * No pattern provided, no destructuring.
                 * Matches anything if list doesn't contain a RestElement.
                 */
                const isUppercase = node.name[0].toUpperCase() === node.name[0];
                if (isUppercase) {
                    return [Pattern.any()];
                    // return Pattern.fromTypeCheck(node);
                }
                /**
                 * Plain lower-case variable names match against any data.
                 *
                 * This also handles the required fallback branch _ => {}.
                 */
                return [Pattern.any()];
            case 'ObjectPattern':
                /**
                 * Object destructure matching only
                 */
                return [Pattern.any()];
            case 'RestElement':
                /**
                 * Spread arguments matching
                 * May contain position-bound Identifiers
                 */
                return [Pattern.any()];
            case 'TSParameterProperty':
                /**
                 * Type matching ???
                 */
                return [Pattern.any()];
            default:
                throw TypeError(`Unreachable: ${node}`);
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
const isMatch = (args: unknown[], branches: Function[], branchIndex: number): boolean => {
    const branch = branches[branchIndex];
    const patterns = createPatterns(branch);
    if (args.length !== patterns.length) return false;
    return args.every((input, position) =>
        patterns[position].some(pattern => {
            switch (pattern.type) {
                case PatternType.Literal:
                    // Are these two values literally the same?
                    return Object.is(pattern.value, input);
                case PatternType.Guard:
                    return false;
                case PatternType.TypeCheck:
                    return false;
                case PatternType.Any:
                    return false;
                case PatternType.Collection:
                    return false;
                default:
                    throw Error(`Unreachable: ${pattern}`);
            }
        })
    );
};

/**
 * A pattern matching operator.
 *
 * Takes all data, then returns a function that takes all branches, then
 * computes and returns the result.
 *
 * @type `(...T[]) -> (...(T[] -> B)[]) -> B`
 *
 * @param args The input data.
 * @returns A function taking functions as arguments. For each function, every
 * default argument value constitutes a special pattern describing the kind of
 * input data the corresponding function body depends on.
 */
export const wavematch = (...args: unknown[]) =>
    /**
     * Branch functions that take a different number of arguments than the
     * wavematched function will be applied to will **not** match.
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
        // Nothing matched, run the default.
        return branches[branches.length - 1].call(null);
    };
