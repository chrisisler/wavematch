import test from 'ava';
import { wavematch } from '../dist/wavematch.cjs.development';

test('Error', t => {
    // Guard
    // TODO
    // Typed
    wavematch(new Error())(
        (e = Error) => t.pass(),
        _ => t.fail()
    );
    wavematch(Error())(
        (e = Error) => t.pass(),
        _ => t.fail()
    );
});

test('Custom Error', t => {
    // Guard
    // TODO
    // Literal
    // Typed
    wavematch(new (class extends Error {})())(
        (s = Error) => t.pass(),
        _ => t.fail()
    );
});

test('Non-Error', t => {
    ['foo', {}, () => {}, -11, 0, 42, Symbol(), true, false, [], null, undefined].forEach(item => {
        wavematch(item)(
            (s = Error) => t.fail(),
            _ => t.pass()
        );
    });
});
