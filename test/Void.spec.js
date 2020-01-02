import test from 'ava';
import { wavematch } from '../dist/wavematch.cjs.development';

test('Null', t => {
    // Guard
    // TODO
    // Literal
    wavematch(null)(
        (n = null) => t.pass(),
        _ => t.fail()
    );
});

test('Undefined', t => {
    // Guard
    // TODO
    // Literal
    wavematch(undefined)(
        (n = undefined) => t.pass(),
        _ => t.fail()
    );
});

test('`void` usages throws an error', t => {
    t.throws(() => {
        // `void` handling code throws error before t.fail() does
        wavematch('foo')(
            (x = void 0) => t.fail(),
            _ => t.fail()
        );
        wavematch(undefined)(
            (x = void 3) => t.fail(),
            _ => t.fail()
        );
    });
});

test('Non-Null', t => {
    [{}, () => {}, -3, 0, 42, Symbol(), Error(), true, false, [], undefined].forEach(nonNull => {
        // Guard
        // TODO
        // Literal
        wavematch(nonNull)(
            (n = null) => t.fail(),
            _ => t.pass()
        );
    });
});

test('Non-Undefined', t => {
    [{}, () => {}, -3, 0, , 42, Symbol(), Error(), true, false, [], null].forEach(defined => {
        // Guard
        // TODO
        // Literal
        wavematch(defined)(
            (n = undefined) => t.fail(),
            _ => t.pass()
        );
    });
});
