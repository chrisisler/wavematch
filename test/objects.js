const assert = require('assert')
const wavematch = require('../src/index')

describe.only('matches objects', () => {
    const someValue = 'magic'
    const fallback = 'DEFAULTED'

    // Note: `N` is greater than zero.

    describe('without "..."', () => {
        it('zero named keys && zero unnamed keys', () => {
            const noKeys = wavematch({
                '{}': someValue
                , '   {   }   ': someValue
                , default: fallback
            })
            assert.strictEqual(noKeys({}), someValue)

            assert.strictEqual(noKeys({ someKey: 1 }), fallback)
            assert.strictEqual(noKeys({ someKey: 1 , other: 1}), fallback)
        })
        it('N named keys && N unnamed keys', () => {
            
        })
        it('N named keys && zero unnamed keys', () => {
            
        })
        it('zero named keys && N unnamed keys', () => {
            
        })
    })
    describe('with "..."', () => {
        it('zero named keys && zero unnamed keys', () => {
            
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
