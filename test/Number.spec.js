import test from 'ava';
import { wavematch } from '../dist/wavematch.cjs.development';

test('Negative Numbers', t => {
    // Guard
    // TODO
    // Literal
    wavematch(-42)(
        (s = -42) => t.pass(),
        _ => t.fail()
    );
    wavematch(-3)(
        (s = 0) => t.fail(),
        (s = 79) => t.fail(),
        _ => t.pass()
    );
    // Typed
    wavematch(-33)(
        (s = Number) => t.pass(),
        _ => t.fail()
    );
});

test('Positive Numbers', t => {
    // Guard TODO
    // wavematch(42)(
    //     (s = _ => _ === 42) => t.pass(),
    //     _ => t.fail(),
    // )
    // Literal
    wavematch(42)(
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

test('Floats', t => {
    // Guard
    // TODO
    // Literal
    wavematch(1.0)(
        (s = 0.9) => t.fail(),
        (s = 1.1) => t.fail(),
        (s = 1) => t.pass(),
        _ => t.fail()
    );
    wavematch(1.0)(
        (s = 0.9) => t.fail(),
        (s = 1.1) => t.fail(),
        (s = 1.0) => t.pass(),
        _ => t.fail()
    );
    wavematch(4.2)(
        (s = 4) => t.fail(),
        (s = 4.0) => t.fail(),
        (s = 4.1) => t.fail(),
        (s = 4.2) => t.pass(),
        (s = 4.3) => t.fail(),
        (s = 5) => t.fail(),
        (s = 5.0) => t.fail(),
        _ => t.fail()
    );
    // Typed
});

test('Non-number', t => {
    [{}, () => {}, '42', Symbol(), Error(), false, [], null, undefined].forEach(notANumber => {
        // Guard
        // TODO
        // Literal
        wavematch(notANumber)(
            (s = -1) => t.fail(),
            (s = 0) => t.fail(),
            (s = 42) => t.fail(),
            _ => t.pass()
        );
        // Typed
        wavematch(notANumber)(
            (s = Number) => t.fail(),
            _ => t.pass()
        );
    });
});

test('Zero', t => {
    // TODO Uncomment as feature coverage increases
    wavematch(0)(
        (n = null) => t.fail(),
        (n = undefined) => t.fail(),
        (n = '') => t.fail(),
        (n = []) => t.fail(),
        (n = -1) => t.fail(),
        (n = 1) => t.fail(),
        (n = NaN) => t.fail(),
        // (n = Infinity) => t.fail(),
        // (n = -Infinity) => t.fail(),
        // Pass
        (n = 0) => t.pass(),
        _ => t.pass()
    );
});

test('Number Ranges', t => {
    // In range
    wavematch(3)(
        (n = Number(0, 5)) => t.pass(),
        _ => t.fail()
    );
    // // Out of range
    wavematch(6)(
        (n = Number(0, 5)) => t.fail(),
        _ => t.pass()
    );
    // Negative numbers
    wavematch(-2)(
        (n = Number(-10, 0)) => t.pass(),
        _ => t.fail()
    );
    // Minimum number up to infinity
    wavematch(77)(
        (n = Number(34, Infinity)) => t.pass(),
        _ => t.fail()
    );
    wavematch(77)(
        (n = Number(94, Infinity)) => t.fail(),
        _ => t.pass()
    );
    // Maximum number up from Negative Infinity
    wavematch(8)(
        (n = Number(-Infinity, 12)) => t.pass(),
        _ => t.fail()
    );
    wavematch(73)(
        (n = Number(-Infinity, 12)) => t.fail(),
        _ => t.pass()
    );
});

// Not Supported currently
// test('BigInt', t => {
//     t.pass()
// })
