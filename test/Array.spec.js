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

// TODO
// test('Array literal with Union elements', t => {
//     wavematch([42])(
//         // Typed and Typed
//         (foo = [Symbol | Number]) => t.pass(),
//         _ => t.fail()
//     );
//     wavematch([42])(
//         // Literal and Literal
//         (foo = [41 | 42]) => t.pass(),
//         _ => t.fail()
//     );
//     wavematch([42])(
//         // Typed and Literal
//         (foo = [Number | 'zoo']) => t.pass(),
//         _ => t.fail()
//     );
// });

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

test('Destructuring patternless', t => {
    wavematch([])(
        ([]) => t.pass(),
        _ => t.fail()
    );

    wavematch(['doggo'])(
        ([abc]) => t.pass(),
        _ => t.fail()
    );
});

// test.only('Destructured Typed', t => {
//     // wavematch([3])(
//     //     ([first] = Array) => t.pass(),
//     //     _ => t.fail()
//     // );

//     // TODO
//     // - Should throw due tue `first` not being assignable
//     // - Instead passes because `Array` type is succesful
//     wavematch([])(
//         // Fails to match due to `first` being unassignable, the given array
//         // input has no first element.
//         ([first] = Array) => t.fail(),
//         _ => t.pass()
//     );
// });

// test('Destructuring with Literal Array pattern', t => {
//     wavematch([3])(
//         ([first] = [String]) => t.pass(),
//         _ => t.fail()
//     );
// });
