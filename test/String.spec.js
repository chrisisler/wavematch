import test from 'ava';
import { wavematch } from '../dist/wavematch.cjs.development';

test('Empty string', t => {
    // Guard
    // TODO
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
    wavematch('')(
        (s = 'foo') => t.fail(),
        _ => t.pass()
    );
    // Typed
    wavematch('')(
        (s = String) => t.pass(),
        _ => t.fail()
    );
});

test('Non-empty string', t => {
    // Guard
    // TODO
    // Literal
    wavematch('foo')(
        (s = 'foo') => t.pass(),
        _ => t.fail()
    );
    wavematch('foo')(
        (s = '') => t.fail(),
        _ => t.pass()
    );
    // Typed
    wavematch('foo')(
        (s = String) => t.pass(),
        _ => t.fail()
    );
});

test('Order Matters', t => {
    wavematch('')(
        (s = 'non-empty') => t.fail(),
        (s = String) => t.pass(),
        (s = '') => t.fail(),
        _ => t.fail()
    );
    wavematch('')(
        (s = 'non-empty') => t.fail(),
        (s = '') => t.pass(),
        (s = String) => t.fail(),
        _ => t.fail()
    );
    // XXX Write tests w/ Guard
    // wavematch('')(
    //     (s = 'non-empty') => t.fail(),
    //     (s = _ => _.length === 0) => t.pass(),
    //     (s = '') => t.fail(),
    //     (s = String) => t.fail(),
    //     _ => t.fail()
    // );
});

test('Non-string', t => {
    [{}, () => {}, -11, 0, 42, Symbol(), Error(), true, false, [], null, undefined].forEach(
        notAString => {
            // Guard
            // TODO
            // wavematch(notAString)(
            //     (s = _ => typeof _ === 'string') => t.fail(),
            //     _ => t.pass()
            // );
            // Literal
            wavematch(notAString)(
                (s = '') => t.fail(),
                (s = 'non-empty') => t.fail(),
                _ => t.pass()
            );
            // Typed
            wavematch(notAString)(
                (s = String) => t.fail(),
                _ => t.pass()
            );
        }
    );
});
