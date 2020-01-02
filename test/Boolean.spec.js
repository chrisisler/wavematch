import test from 'ava';
import { wavematch } from '../dist/wavematch.cjs.development';

test('Boolean', t => {
    // Guard
    // TODO
    // Literal
    wavematch(true)(
        (s = true) => t.pass(),
        _ => t.fail()
    );
    wavematch(false)(
        (s = false) => t.pass(),
        _ => t.fail()
    );
    wavematch(false)(
        (s = true) => t.fail(),
        (s = false) => t.pass(),
        _ => t.fail()
    );
    wavematch(true)(
        (s = false) => t.fail(),
        (s = true) => t.pass(),
        _ => t.fail()
    );
    // Typed
    wavematch(true)(
        (s = Boolean) => t.pass(),
        _ => t.fail()
    );
    wavematch(false)(
        (s = Boolean) => t.pass(),
        _ => t.fail()
    );
});

test('Non-boolean', t => {
    [{}, () => {}, null, undefined, -3, 0, '42', Symbol(), Error(), []].forEach(notABoolean => {
        // Guard
        // TODO
        // Literal
        wavematch(notABoolean)(
            (s = true) => t.fail(),
            (s = false) => t.fail(),
            _ => t.pass()
        );
        // Typed
        wavematch(notABoolean)(
            (s = Boolean) => t.fail(),
            _ => t.pass()
        );
    });
});
