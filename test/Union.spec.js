import test from 'ava';
import { wavematch } from '../dist/wavematch.cjs.development';

test('Literal and Literal', t => {
    const f = x =>
        wavematch(x)(
            (s = 'foo' | 42 | false) => t.pass(),
            _ => t.fail()
        );
    f('foo');
    f(42);
    f(false);

    const isVoid = x =>
        wavematch(x)(
            (x = null | undefined) => t.pass(),
            _ => t.fail()
        );
    isVoid(null);
    isVoid(undefined);
});

test('Literal and Typed', t => {
    const f = x =>
        wavematch(x)(
            (x = '' | Number) => t.pass(),
            _ => t.fail()
        );
    f('');
    f(-1);
    f(0);
    f(1);
    f(Number.MAX_SAFE_INTEGER);
});

test('Typed and Typed', t => {
    const f = x =>
        wavematch(x)(
            (_ = Number | String | Boolean) => t.pass(),
            _ => t.fail()
        );
    f(-1);
    f(0);
    f(1);
    f('');
    f('quux');
    f(true);
    f(false);

    const g = x =>
        wavematch(x)(
            (x = Symbol | Error) => t.pass(),
            _ => t.fail()
        );
    g(Symbol());
    g(Error());

    const miss = x =>
        wavematch(x)(
            (x = RegExp | Number | Error) => t.fail(),
            _ => t.pass()
        );
    miss('bar');
    miss(false);
    miss(Symbol());
});

test('Literal and CustomTyped', t => {
    class Foo {}
    const f = x =>
        wavematch(x)(
            (x = -34 | Foo) => t.pass(),
            _ => t.fail()
        );
    f(-34);
    f(new Foo());
    f(new (class extends Foo {})());
});
