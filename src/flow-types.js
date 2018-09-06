/**
 * @flow
 * @prettier
 */

export type ReflectedArg = $ReadOnly<{
  // wavematch(x)(
  //   (argName = pattern) => {}
  // )
  argName: string,

  // wavematch(person)(
  //   ({ name }) => name
  //   ([ head ]) => head
  // )
  isDestructured: boolean,

  // the default parameter of a given Rule
  // wavematch(x)(
  //   (argName = pattern) => {}
  // )
  pattern?: any,

  // for matching custom types (like 'Person' or 'Car')
  // if this key is present then so is either `.pattern` or `.subPattern`
  customTypeNames?: Array<string>,

  // Patterns can be unions of patterns, like an OR expression:
  // wavematch(random(0, 5))(
  //   (n = 1 | 3 | 5) => 'odd!',
  //   _ => 'even!'
  // )
  // If `subPatterns` is present on the instance, then `patterns` is not.
  subPatterns?: Array<?mixed>
}>

export type RuleExpression = (...Array<mixed>) => ?mixed

export type Rule = $ReadOnly<{|
  allReflectedArgs: Array<ReflectedArg>,

  // the length of `allReflectedArgs`
  arity: number,

  // the body of a given rule - this is a callable function
  expression: RuleExpression,

  // the body of a given rule represented as a string
  // only used for warning about avoiding duplicate rules (I think)
  body: string
|}>
