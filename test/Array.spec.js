import test from 'ava';
import { wavematch } from '../dist/wavematch.cjs.development';

const values = [{}, () => {}, '42', Symbol(), Error(), false, [], null, undefined];

test('Typed', t => {
    // Empty
    wavematch([])(
        (a = Array) => t.pass(),
        _ => t.fail()
    );
    // Non-empty
    values.forEach(value => {
        wavematch([value])(
            (a = Array) => t.pass(),
            _ => t.fail()
        );
    });
});

// TODO git stash pop
// test('Empty literal', t => {
//     wavematch([])(
//         (a = []) => t.pass(),
//         _ => t.fail()
//     );
//     // values.forEach(value => {
//     //     wavematch([value])(
//     //         (a = []) => t.fail(),
//     //         _ => t.pass()
//     //     );
//     // });
// });

// test('Array literal with Typed elements', t => {
//     wavematch([42, 'foo'])(
//         (a = [Number, String]) => t.pass(),
//         _ => t.fail()
//     );
// });

// test('Non-Array', t => {
//     [{}, () => {}, '42', Symbol(), Error(), false, [], null, undefined].forEach(notANumber => {
//         // Guard
//         // TODO
//         // Literal
//         wavematch(notANumber)(
//             (s = -1) => t.fail(),
//             (s = 0) => t.fail(),
//             (s = 42) => t.fail(),
//             _ => t.pass()
//         );
//         // Typed
//         wavematch(notANumber)(
//             (s = Number) => t.fail(),
//             _ => t.pass()
//         );
//     });
// });
