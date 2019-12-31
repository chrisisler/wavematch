import test from 'ava';
import { wavematch } from '../dist/wavematch.cjs.development';

test('Number', t => {
    // Guard
    // TODO
    // Literal
    wavematch(42)(
        (s = -42) => t.fail(),
        (s = 42) => t.pass(),
        _ => t.fail()
    );
    wavematch(42)(
        (s = 0) => t.fail(),
        (s = 79) => t.fail(),
        _ => t.pass()
    );
    // Typed
    wavematch(33)(
        (s = Number) => t.pass(),
        _ => t.fail()
    );
});

// test('Non-number', t => {
//     // Guard
//     // TODO
//     // Literal
//     // TODO
//     // Typed
//     // TODO
// });

test('Zero', t => {
    // TODO Uncomment as feature coverage increases
    wavematch(0)(
        // (n = null) => t.fail(),
        // (n = undefined) => t.fail(),
        // (n = void 0) => t.fail(),
        (n = '') => t.fail(),
        // (n = []) => t.fail(),
        (n = -1) => t.fail(),
        (n = 1) => t.fail(),
        // (n = NaN) => t.fail(),
        // (n = Infinity) => t.fail(),
        // (n = -Infinity) => t.fail(),
        // Pass
        (n = 0) => t.pass(),
        _ => t.pass()
    );
});
