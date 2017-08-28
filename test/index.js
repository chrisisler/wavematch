const assert = require('assert')
const wavematch = require('../src/index')

describe('wavematch', () => {
    const defaultStr = 'DEFAULTED'

    describe('works on arrays', () => {
        it('works with an empty array', () => {
            const resultString =  'i am a fixed string'
            const fn = wavematch({ '[]': () => resultString })
            assert.strictEqual(fn([]), resultString)
        })

        it('works with an array of specified length', () => {
            const one = wavematch({
                '[ foo ]': () => 'just one item'
                , default: () => defaultStr
            })
            assert.strictEqual(one(['one thing in this array']), 'just one item')
            assert.strictEqual(one([]), defaultStr)
            assert.strictEqual(one([1, 2, ]), defaultStr)
            assert.strictEqual(one([1, 2, 3, 4, 5]), defaultStr)

            const two = wavematch({
                '[ foo, bar ]': () => 'two items now'
                , default: () => defaultStr
            })
            assert.strictEqual(two(['first', 'second']), 'two items now')
            assert.strictEqual(two([]), defaultStr)
            assert.strictEqual(two([1, 2, 3, 4, 5, 6, 7,]), defaultStr)
        })

        it('works with an array of non-zero length', () => {
            const anyLen = wavematch({
                '[...]': () => 'this rocks'
                , default: () => defaultStr
            })
            assert.strictEqual(anyLen(['foo']), 'this rocks')
            assert.strictEqual(anyLen(['foo', {}, 3.2]), 'this rocks')
            assert.strictEqual(anyLen(['foo', {}, 3.2, 'bar', null, false, []]), 'this rocks')

            assert.strictEqual(anyLen([]), defaultStr)
            assert.strictEqual(anyLen({}), defaultStr)
            assert.strictEqual(anyLen(''), defaultStr)
            assert.strictEqual(anyLen(0), defaultStr)
        })

        it('does not work with null or undefined (on purpose)', () => {
            const fn = wavematch({
                '[]': () => 'zero'
                , '[x]': () => 'one'
                , '[x,y]': () => 'two'
                , default: () => defaultStr
            })
            assert.strictEqual(fn(null), defaultStr)
            assert.strictEqual(fn(void 0), defaultStr)
        })
    })

    describe('matches booleans', () => {
        it('works with one parameter', () => {
            const fn = wavematch({ false: () => 'sandwich' })
            assert.strictEqual(fn(false), 'sandwich')

            const fn2 = wavematch({ true: () => 'foobar' })
            assert.strictEqual(fn2(true), 'foobar')

            const trailComma = wavematch({ 'false,': () => 'sandwich' })
            assert.strictEqual(trailComma(false), 'sandwich')
        })

        it('works with two parameters', () => {
            const ff = wavematch({ 'false, false': () => 'double false' })
            assert.strictEqual(ff(false, false), 'double false')

            const tt = wavematch({ 'true, true': () => 'double true' })
            assert.strictEqual(tt(true, true), 'double true')

            const tf = wavematch({ 'true, false': () => 'mixed, true first' })
            assert.strictEqual(tf(true, false), 'mixed, true first')

            const ftTrailComma = wavematch({ 'false, true,': () => 'mixed, false first' })
            assert.strictEqual(ftTrailComma(false, true), 'mixed, false first')
        })

        it('works with default', () => {
            const fn = wavematch({
                'false': () => 'sandwich'
                , default: () => 'DEFAULTED ONE'
            })
            assert.strictEqual(fn(false), 'sandwich')
            assert.strictEqual(fn(true), 'DEFAULTED ONE')

            const trailComma = wavematch({
                'false, true,': () => 'mixed, false first'
                , default: () => 'DEFAULTED TWO'
            })
            assert.strictEqual(trailComma(false, true), 'mixed, false first')
            assert.strictEqual(trailComma(true, true), 'DEFAULTED TWO')
        })
    })

    describe('works on strings', () => {
        it('works with one parameter', () => {
            const strMatch = wavematch({ foo: () => 'its a string' })
            assert.strictEqual(strMatch('foo'), 'its a string')

            const trailComma = wavematch({ 'foo,': () => 'still a string' })
            assert.strictEqual(trailComma('foo'), 'still a string')
        })

        it('works with two parameters', () => {
            const strMatch = wavematch({ 'foo, bar': () => 'its two strings' })
            assert.strictEqual(strMatch('foo', 'bar'), 'its two strings')

            const trailComma = wavematch({ 'foo, bar,': () => 'still two strings' })
            assert.strictEqual(trailComma('foo', 'bar'), 'still two strings')
        })

        it('is independent of parameter order', () => {
            const arityTwo = wavematch({ 'a, b': () => 'arity of two' })
            assert.strictEqual(arityTwo('a', 'b'), 'arity of two')
            assert.strictEqual(arityTwo('b', 'a'), 'arity of two')

            const arityThree = wavematch({ 'a, b, c': () => 'arity of three' })
            assert.strictEqual(arityThree('a', 'b', 'c'), 'arity of three')
            assert.strictEqual(arityThree('a', 'c', 'b'), 'arity of three')
            assert.strictEqual(arityThree('b', 'a', 'c'), 'arity of three')
            assert.strictEqual(arityThree('b', 'c', 'a'), 'arity of three')
            assert.strictEqual(arityThree('c', 'b', 'a'), 'arity of three')
            assert.strictEqual(arityThree('c', 'a', 'b'), 'arity of three')
        })

        it('works with default', () => {
            const fn = wavematch({
                'foo, bar': () => 'hello'
                , default: () => defaultStr
            })
            assert.strictEqual(fn(''), defaultStr)
            assert.strictEqual(fn('randomKey'), defaultStr)
            assert.strictEqual(fn('foo', 'bar'), 'hello')
        })

        it('does not work with null or undefined (on purpose)', () => {
            const fn = wavematch({
                'foo': () => 'zero'
                , default: () => defaultStr
            })
            assert.strictEqual(fn(null), defaultStr)
            assert.strictEqual(fn(void 0), defaultStr)
        })
    })

    describe('works recursively (kind of)', () => {
        it('for factorial function', () => {
            const factorial = wavematch({
                0: () => 1
                , default: (n) => n * factorial(n - 1)
            })
            assert.strictEqual(factorial(4), 24)
            assert.strictEqual(factorial(1), 1)
            assert.strictEqual(factorial(0), 1)
        })

        // it('for zipWith function', () => {
        //     const toTuple = (x, y) => [x, y]
        //     const names = [ 'karen', 'joe' ]
        //     const ages = [ 32, 28 ]

        //     //todo: make this work
        //     const zipWith = wavematch({
        //         '_, [], _': () => []
        //         , '_, _, []': () => []
        //         , 'fn, xs, ys': (f, [x, ...xs], [y, ...ys]) => [f(x, y), ...zipWith(f, xs, ys)]

        //         // todo:
        //         // , 'fn, [...], [...]': (f, [x, ...xs], [y, ...ys]) => [f(x, y), ...zipWith(f, xs, ys)]
        //     })

        //     assert.deepEqual(zipWith(toTuple, names, ages), [ [ 'karen', 32 ], [ 'joe', 28 ] ])
        // })
    })

    //todo
    describe('works on numbers', () => {
        it('does not work with null or undefined (on purpose)', () => {
            const fn = wavematch({
                '0': () => 'zero'
                , '1': () => 'one'
                , default: () => defaultStr
            })
            // assert.strictEqual(fn(null), defaultStr)
            assert.strictEqual(fn(void 0), defaultStr)
        })
    })

    // //todo
    // describe('throws an error if no matches and no default', () => {

    // })
})
