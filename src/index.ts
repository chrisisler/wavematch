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
type PrimitiveWrapperName =
    | 'String'
    | 'Number'
    | 'Boolean'
    | 'Symbol'
    | 'BigInt'
    | 'Object'
    | 'Array'
    | 'RegExp'
    | 'Error';

type PrimitiveWrapper =
    | StringConstructor
    | NumberConstructor
    | BooleanConstructor
    | SymbolConstructor
    | BigIntConstructor
    | ObjectConstructor
    | ArrayConstructor
    | RegExpConstructor
    | ErrorConstructor;

const primitiveWrappers = new Map<PrimitiveWrapperName, PrimitiveWrapper>([
    ['String', String],
    ['Number', Number],
    ['Boolean', Boolean],
    ['Symbol', Symbol],
    ['BigInt', BigInt],
    ['Object', Object],
    ['Array', Array],
    ['RegExp', RegExp],
    ['Error', Error],
]);

const isPrimitiveWrapper = (str: unknown): str is PrimitiveWrapperName =>
    typeof str === 'string' && primitiveWrappers.has(str as PrimitiveWrapperName);

enum PatternType {
    /** Predicate function applied to the input. */
    Guard = 'Guard',
    /** Instance of a primitive value. */
    Literal = 'Literal',
    /** Desired type. */
    Typed = 'TypeCheck',
    /** No restrictions on allowed data. */
    Any = 'Any',
    /** Object or array pattern. */
    Collection = 'Collection',
}

interface BasePattern {
    type: PatternType;
    value?: Exclude<unknown, null | undefined | void>;
}

/** For objects and arrays. */
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
    type: PatternType.Typed;
    value: PrimitiveWrapperName;
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

const Pattern = {
    any(): AnyPattern {
        return { type: PatternType.Any };
    },

    /**
     * Transform the node's value into a pattern.
     *
     * @param node The parameter default value of a given branch
     */
    from(node: Expression): Pattern {
        if (Pattern.isTypeCheckPattern(node) && isPrimitiveWrapper(node.name)) {
            return {
                value: node.name,
                type: PatternType.Typed,
            };
        }
        if (Pattern.isGuardPattern(node)) {
            // XXX Extract guardFn
            return {
                value: Boolean,
                type: PatternType.Guard,
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
        // throw Error(`Unhandled pattern: ${JSON.stringify(node, null, 2)}`);
        throw Error('Unhandled pattern');
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
        if (isPrimitiveWrapper(node.name)) return true;
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
        return true;
    },
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
    const branchCode = branch.toString();
    const expression = babelParse(branchCode, { strictMode: true });
    if (!isArrowFunctionExpression(expression)) {
        throw TypeError('Invariant: Expected function');
    }
    if (expression.params.length === 0) {
        throw Error('Invariant: Cannot match against zero parameters');
    }
    if (args.length !== expression.params.length) {
        return false;
    }
    const patterns = expression.params.map((node): Pattern[] => {
        switch (node.type) {
            case 'ArrayPattern':
                throw Error(`Unimplemented: ${node}`);
            case 'AssignmentPattern':
                /**
                 * Pattern matching
                 */
                if (Pattern.isUnion(node.right)) {
                    return Pattern.fromUnion(node.right);
                }
                return [Pattern.from(node.right)];
            case 'Identifier':
                const isUppercase = node.name[0].toUpperCase() === node.name[0];
                if (isUppercase) {
                    return [Pattern.any()];
                }
                /**
                 * Plain JavaScript identifiers match any input data. This also
                 * handles the required fallback branch.
                 */
                return [Pattern.any()];
            case 'ObjectPattern':
                throw Error(`Unimplemented: ${node}`);
            case 'RestElement':
                throw Error(`Unimplemented: ${node}`);
            case 'TSParameterProperty':
                throw Error(`Unimplemented: ${node}`);
            default:
                throw TypeError(`Unreachable: ${node}`);
        }
    });
    return args.every((input, position): boolean =>
        patterns[position].some((pattern: Pattern): boolean => {
            switch (pattern.type) {
                case PatternType.Literal:
                    // Are these two values literally the same?
                    return Object.is(pattern.value, input);
                case PatternType.Guard:
                    throw Error('Unimplemented: isMatch -> Guard');
                case PatternType.Typed:
                    const desiredType: PrimitiveWrapperName = pattern.value;
                    if (primitiveWrappers.has(desiredType)) {
                        return Object.prototype.toString.call(input) === `[object ${desiredType}]`;
                    }
                    throw Error('Unimplemented: isMatch -> Custom Types');
                case PatternType.Any:
                    return true;
                case PatternType.Collection:
                    throw Error('Unimplemented: isMatch -> Collection');
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
 * @returns A function taking functions as arguments. For each function, every
 * default argument value constitutes a special pattern describing the kind of
 * input data the corresponding function body depends on.
 */
export const wavematch = (...inputs: unknown[]) =>
    /**
     * Branch functions that take a different number of arguments than the
     * wavematched function will be applied to will **not** match (or should
     * that throw?).
     */
    (...branches: Function[]): unknown => {
        if (inputs.length === 0) throw TypeError('Invariant: No data');
        if (branches.length === 0) throw TypeError('Invariant: No branches');
        for (let index = 0; index < branches.length; index++) {
            if (isMatch(inputs, branches, index)) {
                const branch = branches[index];
                /**
                 * XXX Erase the default paramaters from `branch`.
                 */
                return branch(...inputs);
            }
        }
        // Nothing matched, run the default.
        return branches[branches.length - 1].call(null);
    };
