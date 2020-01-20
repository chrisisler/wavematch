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
    [{}, () => {}, '42', Symbol(), Error(), false, [], null, undefined].forEach(notANumber => {
        // Literal
        wavematch(notANumber)(
            (s = -1) => t.fail(),
            (s = 0) => t.fail(),
            (s = 42) => t.fail(),
            _ => t.pass()
        );
        // Typed
        wavematch(notANumber)(
            (s = Number) => t.fail(),
            _ => t.pass()
        );
    });
});

/**
 * Array Destructuring
 *
 * > Should these be the same?
 * ([foo]) => Currently matches anything
 * ([foo] = Array) => Currently matches
 *
 * > This works: `([first, ...[]] = [1, 2, 3]) => {};`
 *
 * **********
 *
 * > Currently:
 * (arr = Array)
 * (arr = [])
 * (arr = ['foo', !Fruit | Symbol])
 *
 * > Then:
 * - Assert empty elements
 * ([] = Array) useless pattern
 * ([] = []) useless pattern
 * ([] = ['foo', !Fruit | Symbol]) useless pattern
 *
 * - Assert one element
 * ([foo] = Array) NOT useless pattern, could be on Strings
 * ([foo] = []) useless pattern
 * ([foo] = ['foo', !Fruit | Symbol]) GOOD: pattern length > param length
 *
 * - Assert one element, empty remaining elements
 * ([foo, ...[]] = Array) useless pattern
 * ([foo, ...[]] = []) useless
 * ([foo, ...[]] = ['foo', !Fruit | Symbol]) GOOD: pattern length > param length
 *
 * - Assert one element, non-empty remaining elements
 * ([foo, ...rest] = Array) useless pattern
 * ([foo, ...rest] = []) useless
 * ([foo, ...rest] = ['foo', !Fruit | Symbol]) GOOD: pattern length > param length
 */
test('With destructuring', t => {
    wavematch([3])(
        ([first] = Array) => t.pass(),
        _ => t.fail()
    );
});
