import test from 'ava';
import { wavematch } from '../dist/wavematch.cjs.development';

test('Symbol', t => {
    // Guard
    // TODO
    // Typed
    wavematch(Symbol())(
        (e = Symbol) => t.pass(),
        _ => t.fail()
    );
});

test('Non-Symbol', t => {
    ['foo', {}, () => {}, -11, 0, 42, Error(), true, false, [], null, undefined].forEach(item => {
        wavematch(item)(
            (s = Symbol) => t.fail(),
            _ => t.pass()
        );
    });
});
