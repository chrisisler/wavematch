import test from 'ava';
import { wavematch } from '../dist/wavematch.cjs.development';

test('Empty Object', t => {
    // Literal
    wavematch({})(
        (obj = {}) => t.pass(),
        _ => t.fail()
    );
    // Typed
    wavematch({})(
        (s = Object) => t.pass(),
        _ => t.fail()
    );
});

// test('Non-empty Object', t => {
//     // Guard
//     // TODO
//     // Literal
//     wavematch('foo')(
//         (s = '') => t.fail(),
//         _ => t.pass()
//     );
//     // Typed
//     wavematch('foo')(
//         (s = String) => t.pass(),
//         _ => t.fail()
//     );
// });
