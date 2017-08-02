const assert = require('assert')
const rematch = require('../')

describe('rematch', () => {
    describe('pattern matches', () => {
        it('works on objects (and handles trailing key commas)', () => {
            const hasX = 'has key x'
            const hasXY = 'has keys x and y'

            const fn = rematch({
                '{ x }': () => hasX
                , '{ x, y, }': () => hasXY
            })
            assert.strictEqual(fn({ x: 3 }), hasX)
            assert.strictEqual(fn({ x: 3, y: 4 }), hasXY)
        })

        // it('works on arrays', () => {

        // })

        // it('works on booleans', () => {

        // })

        // it('works on objects', () => {

        // })

        // it('works on strings', () => {

        // })

        // it('works on numbers', () => {

        // })

        // it('throws an error no matches and no default', () => {

        // })
    })
})
