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

test('Empty literal', t => {
    wavematch([])(
        (a = []) => t.pass(),
        _ => t.fail()
    );
    values.forEach(value => {
        wavematch([value])(
            (a = []) => t.fail(),
            _ => t.pass()
        );
    });
});

test('Array literal with Typed elements', t => {
    wavematch([42, 'foo'])(
        (a = [Number, String]) => t.pass(),
        _ => t.fail()
    );
    wavematch([42, 'foo'])(
        (a = [Number, Object]) => t.fail(),
        _ => t.pass()
    );
});

test('Array literal with Literal elements', t => {
    wavematch([42, 'foo'])(
        (a = [-2, 'bar']) => t.fail(),
        (b = [42, 'foo']) => t.pass(),
        _ => t.fail()
    );
    wavematch([Error(), []])(
        (x = [Error, []]) => t.pass(),
        _ => t.fail()
    );
});

test('Non-Array', t => {
    [{}, () => {}, '42', Symbol(), Error(), false, null, undefined].forEach(notAnArray => {
        // Literal
        wavematch(notAnArray)(
            (s = []) => t.fail(),
            _ => t.pass()
        );
        // Typed
        wavematch(notAnArray)(
            (s = Array) => t.fail(),
            _ => t.pass()
        );
    });
});

test('Destructuring with no pattern', t => {
    wavematch([])(
        ([]) => t.pass(),
        _ => t.fail()
    );
});

test('Destructuring with pattern', t => {
    wavematch([3])(
        ([first] = Array) => t.pass(),
        _ => t.fail()
    );
});
