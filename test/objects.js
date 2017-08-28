const assert = require('assert')
const wavematch = require('../src/index')

// Note: `N` is greater than zero.

describe.only('matches objects', () => {
    const someValue = 'magic'
    const fallback = 'DEFAULTED'

    describe('without "..."', () => {
        it('zero named keys && zero unnamed keys', () => {
            const noKeys = wavematch({
                '{}': someValue
                , '   {   }   ': someValue
                , default: fallback
            })
            assert.strictEqual(noKeys({}), someValue)

            assert.strictEqual(noKeys({ someKey: 1 }), fallback)
            assert.strictEqual(noKeys({ someKey: 1 , other: 1 }), fallback)
        })

        it('N named keys && N unnamed keys', () => {
            const namedXYAndUnnamedKey = 'named x and y keys, unnamed key'
            const namedXAndUnnamedKey = 'named key: x, unnamed key'
            const namedZAndTwoUnnamedKeys = 'named key: z, two unnamed keys'

            const bothFixedLengthKeys = wavematch({
                '{ x, y, _, }': namedXYAndUnnamedKey
                , '{ x, _ }': namedXAndUnnamedKey
                , '{ z, _, _ }': namedZAndTwoUnnamedKeys
                , default: fallback
            })

            assert.strictEqual(bothFixedLengthKeys({ x: 1, foo: 1 }), namedXAndUnnamedKey)
            assert.strictEqual(bothFixedLengthKeys({ x: 1, y: 1 }), namedXAndUnnamedKey)
            assert.strictEqual(bothFixedLengthKeys({ x: 1, y: 1, foo: 1 }), namedXYAndUnnamedKey)
            assert.strictEqual(bothFixedLengthKeys({ z: 1, bar: 1, foo: 1 }), namedZAndTwoUnnamedKeys)

            // works
            assert.strictEqual(bothFixedLengthKeys({}), fallback)
            assert.strictEqual(bothFixedLengthKeys({ foo: 1 }), fallback)
            assert.strictEqual(bothFixedLengthKeys({ bar: 1 }), fallback)
            assert.strictEqual(bothFixedLengthKeys({ x: 1 }), fallback)
            assert.strictEqual(bothFixedLengthKeys({ z: 1, foo: 1 }), fallback)
        })

        it.only('N named keys && zero unnamed keys', () => {
            const x = 'x'
            const xy = 'xy'
            const xyz = 'xyz'
            const namedFixedLengthKeys = wavematch({
                '{ x }': x
                , '{ x, y, }': xy
                , '{ x, y, z }': xyz
                , default: fallback
            })
            // assert.strictEqual(namedFixedLengthKeys({ x: 1 }), x)
            assert.strictEqual(namedFixedLengthKeys({ x: 1, y: 1 }), xy)
            // assert.strictEqual(namedFixedLengthKeys({ x: 1, y: 1, z: 1 }), xyz)

            // assert.strictEqual(namedFixedLengthKeys({}), fallback)
            // assert.strictEqual(namedFixedLengthKeys({ z: 1 }), fallback)
            // assert.strictEqual(namedFixedLengthKeys({ y: 1 }), fallback)
            // assert.strictEqual(namedFixedLengthKeys({ y: 1, z: 1 }), fallback)
            
        })

        it('zero named keys && N unnamed keys', () => {
            const unnamedFixedLengthKeys = wavematch({
                '{ _ }': 'one'
                , '{ _, _ }': 'two'
                , '{ _, _, _ }': 'three'
                , default: fallback
            })

            assert.strictEqual(unnamedFixedLengthKeys({ x: 1 }), 'one')
            assert.strictEqual(unnamedFixedLengthKeys({ x: 1, y: 1 }), 'two, y')
            assert.strictEqual(unnamedFixedLengthKeys({ x: 1, y: 1, z: 1 }), 'three, y, z')

            assert.strictEqual(unnamedFixedLengthKeys({}), fallback)
            assert.strictEqual(unnamedFixedLengthKeys({ a: 1, b: 2, c: 3, d: 4 }), fallback)
        })
    })

    describe('with "..."', () => {
        it('zero named keys && zero unnamed keys', () => {
            //test if each desired key matches the input obj
            const bothZeroKeys = wavematch({
                '{...}': 'neither'
                , '   {   ...    }   ': 'neither'
                , default: fallback
            })
            assert.strictEqual(bothZeroKeys({}), 'neither')

            assert.strictEqual(bothZeroKeys({}), fallback)
        })
        it('at least N named keys && at least N unnamed keys', () => {
            
        })
        it('at least N named keys && zero unnamed keys', () => {
            
        })
        it('zero named keys && at least N unnamed keys', () => {
            
        })
    })
})

function otherTests() {
    it('is independent of key ordering', () => {
        const two = wavematch({ '{ y, x }': () => 'two params' })
        assert.strictEqual(two({ x: 3, y: 4 }), 'two params')
        assert.strictEqual(two({ y: 3, x: 4 }), 'two params')

        const three = wavematch({ '{ x, y, z }': () => 'three params' })
        assert.strictEqual(three({ x: 3, y: 4, z: 5 }), 'three params')
        assert.strictEqual(three({ x: 3, z: 4, y: 5 }), 'three params')
        assert.strictEqual(three({ y: 3, x: 4, z: 5 }), 'three params')
        assert.strictEqual(three({ y: 3, z: 4, x: 5 }), 'three params')
        assert.strictEqual(three({ z: 3, x: 4, y: 5 }), 'three params')
        assert.strictEqual(three({ z: 3, y: 4, x: 5 }), 'three params')
    })
    it('works with trailing commas', () => {
        const fn = wavematch({
            '{ x, }': () => hasX
            , '{ x, y, }': () => hasXandHasY
        })
        assert.strictEqual(fn({ x: 3 }), hasX)
        assert.strictEqual(fn({ x: 3, y: 4 }), hasXandHasY)
    })
    it('does not work with null or undefined (on purpose)', () => {
        const fn = wavematch({
            '{ foo, bar }': () => 'hello'
            , default: () => defaultStr
        })
        assert.strictEqual(fn(null), defaultStr)
        assert.strictEqual(fn(void 0), defaultStr)
    })
}
