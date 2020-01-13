import test from 'ava';
import { wavematch } from '../dist/wavematch.cjs.development';

test('Typed', t => {
    wavematch({ prop: 42 })(
        (s = Object) => t.pass(),
        _ => t.fail()
    );
    wavematch({ prop: 'foo' })(
        (s = Object) => t.pass(),
        _ => t.fail()
    );
    wavematch({})(
        (s = Object) => t.pass(),
        _ => t.fail()
    );
});

test('Empty Object', t => {
    wavematch({})(
        (obj = {}) => t.pass(),
        _ => t.fail()
    );
});

test('Object w/ Literal', t => {
    wavematch({ prop: 42 })(
        (number = { prop: -42 }) => t.fail(),
        (number = { prop: -42.0 }) => t.fail(),
        (number = { prop: 0 }) => t.fail(),
        (number = { prop: 0.42 }) => t.fail(),
        (number = { prop: 4.2 }) => t.fail(),
        (number = { prop: 42 }) => t.pass(),
        (number = { prop: 43 }) => t.fail(),
        _ => t.fail()
    );
    wavematch({ foo: 'bar' })(
        (str = { foo: '' }) => t.fail(),
        (str = { foo: 'Foo' }) => t.fail(),
        (str = { foo: 'fladksf' }) => t.fail(),
        (str = { foo: 'foo' }) => t.fail(),
        (str = { foo: 'bar' }) => t.pass(),
        _ => t.fail()
    );
    wavematch({ foo: false })(
        (str = { foo: true }) => t.fail(),
        (str = { foo: false }) => t.pass(),
        _ => t.fail()
    );
});

test('Object w/ Typed', t => {
    wavematch({ foo: false })(
        (str = { foo: String }) => t.fail(),
        (str = { foo: Number }) => t.fail(),
        (str = { foo: Boolean }) => t.pass(),
        _ => t.fail()
    );
    wavematch({ prop: 42 })(
        (number = { prop: Boolean }) => t.fail(),
        (number = { prop: Number }) => t.pass(),
        _ => t.fail()
    );
    wavematch({ foo: 'bar' })(
        (str = { foo: String }) => t.pass(),
        (str = { foo: Symbol }) => t.fail(),
        _ => t.fail()
    );
});

// test('Object w/ CustomTyped', t => {

// });

// test('Object w/ Array', t => {

// });

// test('Object w/ Object', t => {

// });

// test('Object w/ Negation', t => {

// });

// test('Object w/ Union', t => {

// });
