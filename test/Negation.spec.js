import test from 'ava';
import { wavematch } from '../dist/wavematch.cjs.development';

test('Typed', t => {
    wavematch({})(
        (x = !Object) => t.fail(),
        (x = Object) => t.pass(),
        _ => t.fail()
    );
    wavematch(() => {})(
        (x = !Function) => t.fail(),
        (x = Function) => t.pass(),
        _ => t.fail()
    );
    wavematch(42)(
        (x = !Number) => t.fail(),
        (x = Number) => t.pass(),
        _ => t.fail()
    );
    wavematch(Symbol())(
        (x = !Symbol) => t.fail(),
        (x = Symbol) => t.pass(),
        _ => t.fail()
    );
    wavematch(Error())(
        (x = !Error) => t.fail(),
        (x = Error) => t.pass(),
        _ => t.fail()
    );
    wavematch(true)(
        (x = !Boolean) => t.fail(),
        (x = Boolean) => t.pass(),
        _ => t.fail()
    );
    wavematch([])(
        (x = !Array) => t.fail(),
        (x = Array) => t.pass(),
        _ => t.fail()
    );
});

test('Literal', t => {
    wavematch('foo')(
        (s = !'foo') => t.fail(),
        (s = 'foo') => t.pass(),
        _ => t.fail()
    );
    wavematch(42)(
        (x = !42) => t.fail(),
        (x = 42) => t.pass(),
        _ => t.fail()
    );
    wavematch(true)(
        (x = !true) => t.fail(),
        (x = true) => t.pass(),
        _ => t.fail()
    );
    wavematch(null)(
        (x = !null) => t.fail(),
        (x = null) => t.pass(),
        _ => t.fail()
    );
    wavematch(undefined)(
        (x = !undefined) => t.fail(),
        (x = undefined) => t.pass(),
        _ => t.fail()
    );
    // TODO Collection.Array
    // wavematch([])(
    //     (x = ![]) => t.fail(),
    //     (x = Array) => t.pass(),
    //     _ => t.fail()
    // );
});

test('CustomTyped', t => {
    class Foo {}
    wavematch(new Foo())(
        (x = !Foo) => t.fail(),
        (x = Foo) => t.pass(),
        _ => t.fail()
    );
    class Bar extends Foo {}
    wavematch(new Bar())(
        (x = !Bar) => t.fail(),
        (x = Bar) => t.pass(),
        _ => t.fail()
    );
    // extended
    wavematch(new Bar())(
        (x = !Foo) => t.fail(),
        (x = Foo) => t.pass(),
        _ => t.fail()
    );
    class Quux extends Bar {}
    wavematch(new Quux())(
        (x = !Bar) => t.fail(),
        (x = Bar) => t.pass(),
        _ => t.fail()
    );

    // Doesn't work because of toString approach:
    // wavematch(new Quux())(
    //     (x = !Foo) => t.fail(),
    //     (x = Foo) => t.pass(),
    //     _ => t.fail()
    // );
});
