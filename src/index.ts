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
    NumericLiteral,
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
    | FunctionConstructor
    | StringConstructor
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

const isPrimitiveConstructor = (str: unknown): str is PrimitiveConstructorName =>
    typeof str === 'string' && primitiveConstructors.has(str as PrimitiveConstructorName);

enum PatternType {
    /** Predicate function applied to the input. */
    Guard = 'Guard',
    /** Instance of a primitive value. Interacts with PrimitiveConstructor. */
    Literal = 'Literal',
    /** Desired type. */
    Typed = 'Typed',
    /** No restrictions on allowed data. */
    Any = 'Any',
    /** Object or array pattern. */
    Collection = 'Collection',
}

interface BasePattern {
    type: PatternType;
}

/** Can this pattern be negated? */
interface PatternNegation {
    negated: boolean;
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

interface AnyPattern extends BasePattern {
    type: PatternType.Any;
}

type Pattern = GuardPattern | LiteralPattern | TypedPattern | CollectionPattern | AnyPattern;

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
        const isNegated = node.type === 'UnaryExpression' && node.operator === '!';
        if (Pattern.isTypedPattern(node)) {
            return {
                value: node.name,
                type: PatternType.Typed,
                negated: isNegated,
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
                negated: isNegated,
            };
        }
        if (Pattern.isNumber(node)) {
            return {
                type: PatternType.Literal,
                value: node.argument.value,
                negated: isNegated,
            };
        }
        if (isNullLiteral(node)) {
            return {
                value: 'null',
                type: PatternType.Literal,
                negated: false, // TODO Negation
            };
        }
        if (Pattern.isUndefinedLiteral(node)) {
            return {
                value: 'undefined',
                type: PatternType.Literal,
                negated: false, // TODO Negation
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
        throw Error(JSON.stringify(node, null, 2));
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
     * Handles patterns not covered by `isNumericLiteral`.
     * - Include cases like negative instances `-42`
     */
    isNumber(
        node: Expression
    ): node is UnaryExpression & { argument: NumericLiteral; operator: '+' | '-' } {
        if (node.type === 'UnaryExpression' && node.prefix) {
            if (node.operator === '-' || node.operator === '+') {
                return isNumericLiteral(node.argument);
            }
        }
        return false;
    },

    isUndefinedLiteral(node: Expression): node is Literal {
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
                    // TODO Custom Types
                    return [Pattern.any()];
                }
                // Named patterns match any input.
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
                    const isMatched = Object.is(pattern.value, input);
                    return pattern.negated ? !isMatched : isMatched;
                case PatternType.Guard:
                    throw Error('Unimplemented: isMatch -> Guard');
                case PatternType.Typed:
                    // TODO pattern.negated
                    const desiredType: PrimitiveConstructorName = pattern.value;
                    if (primitiveConstructors.has(desiredType)) {
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
 * A control flow mechanism.
 *
 * Takes all arguments, returns a function which takes all branches, and
 * evaluates the first branch to successfully match against the input.
 *
 * For each given branch, each default argument value constitutes a special
 * pattern describing the kind of input data the corresponding function body
 * expects.
 */
export const wavematch = (...inputs: unknown[]) =>
    /**
     * - Branches accepting a number of arguments other the amount received
     * - Order matters; a branch matching on `String` will match over `'foo'`
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
