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
    wavematch({ x: 1, y: 2 })(
        (obj = { x: 1, y: 2 }) => t.pass(),
        _ => t.fail()
    );
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

test('Object w/ CustomTyped', t => {
    class Fruit {}

    wavematch({ key: new Fruit() })(
        (value = { key: Fruit }) => t.pass(),
        _ => t.fail()
    );

    class Apple extends Fruit {}

    wavematch({ x: new Apple() })(
        (value = { x: Fruit }) => t.pass(),
        _ => t.fail()
    );
    wavematch({ x: new Apple() })(
        (value = { x: Apple }) => t.pass(),
        _ => t.fail()
    );
});

test('Object w/ Array', t => {
    // Typed
    wavematch({ array: [] })(
        (obj = { array: Array }) => t.pass(),
        _ => t.fail()
    );
    wavematch({ array: ['foo'] })(
        (obj = { array: Array }) => t.pass(),
        _ => t.fail()
    );
    // Empty Literal
    wavematch({ array: [] })(
        (obj = { array: [] }) => t.pass(),
        _ => t.fail()
    );
    wavematch({ array: [] })(
        (obj = { array: ['foo'] }) => t.fail(),
        _ => t.pass()
    );
    // Array literal with Typed elements
    wavematch({ array: [42, 'foo'] })(
        (obj = { array: [Number, String] }) => t.pass(),
        _ => t.fail()
    );
    wavematch({ array: [42, 'foo'] })(
        (obj = { array: [String, String] }) => t.fail(),
        _ => t.pass()
    );
});

test('Object w/ Object', t => {
    wavematch({ data: { on: true } })(
        (arg = { data: { on: Boolean } }) => t.pass(),
        _ => t.fail()
    );
    wavematch({ data: { on: false } })(
        (arg = { data: Symbol | { on: !3 } }) => t.pass(),
        _ => t.fail()
    );
});

test('Object w/ Negation', t => {
    wavematch({ baz: 33 })(
        (obj = { baz: !Symbol }) => t.pass(),
        _ => t.fail()
    );
    wavematch({ baz: 33 })(
        (obj = { baz: !32 }) => t.pass(),
        _ => t.fail()
    );
    // Cannot negate an entire object pattern
    t.throws(() => {
        wavematch({ baz: 33 })(
            (obj = !{ baz: Number }) => t.pass(),
            _ => t.fail()
        );
    });
});

test('Object w/ Union', t => {
    wavematch({ a: 1 })(
        (obj = { a: 2 } | 3 | { a: Number }) => t.pass(),
        _ => t.fail()
    );
    wavematch({ a: [Error(), Symbol()] })(
        (obj = { a: [Symbol, Error] }) => t.fail(),
        (obj = { a: 3 | [Error, Symbol] }) => t.pass(),
        _ => t.fail()
    );
});

test('Object w/ Void', t => {
    wavematch({ n: null })(
        (obj = { n: undefined }) => t.fail(),
        _ => t.pass()
    );
    wavematch({ n: null })(
        (obj = { n: null }) => t.pass(),
        _ => t.fail()
    );
    wavematch({ n: undefined })(
        (obj = { n: null }) => t.fail(),
        _ => t.pass()
    );
    wavematch({ n: undefined })(
        (obj = { n: undefined }) => t.pass(),
        _ => t.fail()
    );
});
