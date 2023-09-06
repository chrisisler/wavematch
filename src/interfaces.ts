import { ObjectMethod, Expression, SpreadElement, ObjectProperty } from '@babel/types';

/**
 * Supported, native value constructors.
 */
export type PrimitiveConstructorName =
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

export type PrimitiveConstructor =
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

export enum PatternType {
    /** Instance of a primitive JS value. Interacts with PrimitiveConstructor. */
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
    /** Valid ranges of numbers, inclusive. */
    NumberRange = 'NumberRange',
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

/** Can this pattern be negated (using `!`)? */
interface PatternNegation {
    negated: boolean;
}

export type PatternArray = PatternBase & { type: PatternType.Array } & (
        | {
              elements: null;
              requiredSize: number;
          }
        | {
              elements: (Expression | SpreadElement | null)[];
              requiredSize: null;
          }
    );

export interface PatternObject extends PatternBase {
    type: PatternType.Object;
    properties: undefined | (ObjectMethod | ObjectProperty | SpreadElement)[];
    requiredKeys: undefined | string[];
}

export interface PatternLiteral extends PatternBase, PatternNegation {
    type: PatternType.Literal;
    /**
     * Data that is not an object and has no methods.
     * A primitive instance.
     */
    value: string | number | boolean | null | undefined | symbol | bigint;
    negated: boolean;
}

export interface PatternTyped extends PatternBase, PatternNegation {
    type: PatternType.Typed;
    desiredType: PrimitiveConstructorName;
    negated: boolean;
}

export interface PatternClassTyped extends PatternBase, PatternNegation {
    type: PatternType.ClassTyped;
    className: string;
    negated: boolean;
}

export interface PatternRegExp extends PatternBase {
    type: PatternType.RegExp;
    regExp: RegExp;
}

export interface PatternAny extends PatternBase {
    type: PatternType.Any;
}

export interface PatternNumberRange extends PatternBase {
    type: PatternType.NumberRange;
    low: number;
    high: number;
}

export type Pattern =
    | PatternLiteral
    | PatternTyped
    | PatternClassTyped
    | PatternArray
    | PatternObject
    | PatternRegExp
    | PatternNumberRange
    | PatternAny;
