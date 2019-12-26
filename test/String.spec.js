import test from 'ava';
import { wavematch } from '../dist/wavematch.cjs.development';

test('Empty string', t => {
    // Guard
    // wavematch('')(
    //     (s = _ => typeof _ === 'string') => t.pass(),
    //     _ => t.fail()
    // );
    // wavematch('')(
    //     (s = _ => _.length === 0) => t.pass(),
    //     _ => t.fail()
    // );
    // Literal
    wavematch('')(
        (s = '') => t.pass(),
        _ => t.fail()
    );
    // TypeCheck
    wavematch('')(
        (s = String) => t.pass(),
        _ => t.fail()
    );
});

// test('Non-empty string', t => {
//     // Guard
//     // Literal
//     // TypeCheck
// });

/**
 * enum Specificity {
 *     PatternType.Guard, // Highest Specificity
 *     PatternType.Literal,
 *     PatternType.TypeCheck, // Lowest
 * }
 *
 * Guard gets highest Spec because it asks _exact_ questions about data. It is
 * akin to a scalpel for selecting data. Guards match on data regardless of the
 * type of the data, which may be an argument for the opposite -- that Guards
 * are the least specific, but a user is expected to place a Guard pattern
 * first in order. Next is the literal.
 *
 * OR, alternatively, we could do away with Specificity entirely and rely on
 * the order of the supplied branches. That may enable or disable potentially
 * desired features as the tests are re-written.
 *
 * Specificity means that a branch that would be chosen if it were the only
 * branch supplied (excluding the fallback) is NOT chosen because a branch
 * before/after it is more detailed about the data that the pattern(s)
 * describes.
 */
// test('Specificity XXX Order Matters', t => {
//     // Guard
//     wavematch('')(
//         (s = 'non-empty') => t.fail(),
//         (s = String) => t.pass(),
//         (s = '') => t.fail(),
//         _ => t.fail()
//     );
//     wavematch('')(
//         (s = 'non-empty') => t.fail(),
//         (s = '') => t.pass(),
//         (s = String) => t.fail(),
//         _ => t.fail()
//     );
//     // Literal
//     // TypeCheck
// });

// test('Non-string', t => {
//     [{}, () => {}, 42, Symbol(), Error(), false, []].forEach(notAString => {
//         // Guard
//         wavematch(notAString)(
//             (s = _ => typeof _ === 'string') => t.fail(),
//             _ => t.pass()
//         );
//         // Literal
//         wavematch(notAString)(
//             (s = '') => t.fail(),
//             (s = 'non-empty') => t.fail(),
//             _ => t.pass()
//         );
//         // TypeCheck
//         wavematch(notAString)(
//             (s = String) => t.fail(),
//             _ => t.pass()
//         );
//     });
// });
