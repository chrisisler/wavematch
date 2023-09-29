import { parseExpression } from '@babel/parser';

import { Patterns } from './patterns';

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

function doesMatch(args: readonly unknown[], branch: Function): boolean {
    const ast = parseExpression(branch.toString());
    if (ast.type !== 'ArrowFunctionExpression') {
        throw TypeError(`Expected an arrow function. Received: ${ast}`);
    }
    // Only match branches that take the same number of inputs
    if (args.length !== ast.params.length) return false;
    return args.every((arg, index) => Patterns.doesMatch(arg, ast.params[index]));
}
