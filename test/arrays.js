const assert = require('assert')
const wavematch = require('../src/index')

const val = 'hi' // doesn't matter what actual value is
const largeArray = [...Array(100)].map(_ => val)
const fallback = 'DEFAULTED'
const nonArrayDataTypes = [ 0, 4.2, '', {}, (function(){}), void 0, null, /regexp/ ]

describe('works on arrays', () => {

    describe('without "..."', () => {

        // cases: '[]'
        it('zero length', () => {
            const zeroLength = wavematch({
                '[]': 'empty'
                , '  [   ]  ': 'empty'
                , default: fallback
            })

            assert.strictEqual(zeroLength([]), 'empty')

            assert.strictEqual(zeroLength([ 1 ]), fallback)
            assert.strictEqual(zeroLength([ 1, 2 ]), fallback)
            assert.strictEqual(zeroLength([ 1, 2, 3 ]), fallback)
            assert.strictEqual(zeroLength(largeArray), fallback)

            nonArrayDataTypes.forEach(notAnArray => {
                assert.strictEqual(zeroLength(notAnArray), fallback)
            })
        })

        // cases: '[ x ]', '[ x, y ]', '[ x, y, z ]', etc.
        it('exact non-zero length', () => {
            // The names used do not matter
            // There is _no_ difference between named vs unnamed
            const exactNonZeroLength = wavematch({
                '[ x ]'          : 'one'
                , '[ foo ]'      : 'one'
                , '[ whatever ]' : 'one'
                , '[ _ ]'        : 'one'

                , '[ x, x ]'     : 'two'
                , '[ foo, bar ]' : 'two'
                , '[ _, _ ]'     : 'two'

                , '[ a, b, c ]'  : 'three'
                , '[ _, _, _ ]'  : 'three'

                , default        : fallback
            })

            assert.strictEqual(exactNonZeroLength([ val ]), 'one')
            assert.strictEqual(exactNonZeroLength([ val, val ]), 'two')
            assert.strictEqual(exactNonZeroLength([ val, val, val]), 'three')

            assert.strictEqual(exactNonZeroLength([]), fallback)

            nonArrayDataTypes.forEach(notAnArray => {
                assert.strictEqual(exactNonZeroLength(notAnArray), fallback)
            })
        })
    })

    describe('with "..."', () => {
        // case: '[...]'
        it('any length', () => {
            // `default` case will _never_ occur if an array is passed in
            const anyLength = wavematch({
                '[...]': 'any'
                , '   [ ... ]   ': 'any'
                , default: fallback
            })

            assert.strictEqual(anyLength([]), 'any')
            assert.strictEqual(anyLength([ val ]), 'any')
            assert.strictEqual(anyLength([ val, val ]), 'any')
            assert.strictEqual(anyLength([ val, val, val ]), 'any')
            assert.strictEqual(anyLength(largeArray), 'any')
            assert.strictEqual(anyLength([ 'str', {}, 3.2, null, false, [] ]), 'any')

            nonArrayDataTypes.forEach(notAnArray => {
                assert.strictEqual(anyLength(notAnArray), fallback)
            })
        })

        // '[ x, ... ]'
        it('at least N length', () => {
            // must do custom greedy `highest-token` logic like with objects.
            const atLeastNonZero = wavematch({
                '[ x, ... ]': 'at least one'
                , '[ foo, bar, ... ]': 'at least two'
                , '[ _, _, _, ... ]': 'at least three'
                , '[ name, age, id, other, ... ]': 'at least four'
                , default: fallback
            })

            assert.strictEqual(atLeastNonZero([ val                ]), 'at least one')
            assert.strictEqual(atLeastNonZero([ val, val           ]), 'at least two')
            assert.strictEqual(atLeastNonZero([ val, val, val      ]), 'at least three')
            assert.strictEqual(atLeastNonZero([ val, val, val, val ]), 'at least four')

            assert.strictEqual(atLeastNonZero([ val, val, val, val, val ]), 'at least four')
            assert.strictEqual(atLeastNonZero(largeArray), 'at least four')

            assert.strictEqual(atLeastNonZero([]), fallback)

            nonArrayDataTypes.forEach(notAnArray => {
                assert.strictEqual(atLeastNonZero(notAnArray), fallback)
            })
        })
    })

    // a bit redundant
    it('does not work with null or undefined (on purpose)', () => {
        const allArrayCases = wavematch({
            '[]'            : () => val
            , '[x]'         : () => val
            , '[x, y]'      : () => val
            , '[...]'       : () => val
            , '[x, ...]'    : () => val
            , '[x, y, ...]' : () => val
            , default       : () => fallback
        })
        nonArrayDataTypes.forEach(notAnArray => {
            assert.strictEqual(allArrayCases(notAnArray), fallback)
        })
    })
})
