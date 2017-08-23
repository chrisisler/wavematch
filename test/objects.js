const assert = require('assert')
const rematch = require('../src/index')

const defaultStr = 'DEFAULTED'
const hasX = 'has key x'
const hasXandHasY = 'has keys x and y'

describe.only('matches objects', () => {
    // empty {}
    it.only('works with zero keys', () => {
        const fn = rematch({
            '{}'             : () => 'empty obj'
            , '{,}'          : () => 'empty obj'
            , ' {,} ,'       : () => 'empty obj'
            , ' {,,,,,},,, ' : () => 'empty obj'
            , ' {    }    '  : () => 'empty obj'

            , default: () => defaultStr
        })
        assert.strictEqual(fn({}), 'empty obj')
        assert.strictEqual(fn({x:3}), defaultStr)

        //not sure if this is a helpful test to add
        const multiArg = rematch({
            '_, {}': () => 'foo'
            , default: () => defaultStr
        })
        assert.strictEqual(multiArg(3, {}), 'foo')
        assert.strictEqual(multiArg({}),defaultStr)
    })

    // exactly x
    it('works with one key', () => {
        const fn = rematch({
            '{ x }': () => hasX
            , default: () => defaultStr
        })
        assert.strictEqual(fn({ x: 3 }), hasX)
        assert.strictEqual(fn({}), defaultStr)
        assert.strictEqual(fn({x:3,y:4}), defaultStr)
    })

    // exactly x and y
    it('works with two keys', () => {
        const fn = rematch({
            '{ x, y }': () => hasXandHasY
            , default: () => defaultStr
        })
        assert.strictEqual(fn({ x: 3, y: 4 }), hasXandHasY)
        assert.strictEqual(fn({ x: 3 }), defaultStr)
        assert.strictEqual(fn({}), defaultStr)
    })

    // ... zero or more of any name
    // exactly x and zero or more of any name
    // exactly x, y, and zero or more of any name
    // exactly one of any name
    // exactly two of any name
    // exactly one of any name and zero or more of any name


    it('works with at least one key', () => {
        const fn = rematch({
            '{ x, ... }': () => 'it worked!'
            , default: () => defaultStr
        })
        assert.strictEqual(fn({x:3}), 'it worked!')
        assert.strictEqual(fn({x:3, y:4}), 'it worked!')
        assert.strictEqual(fn({x:3, y:4, z:5}), 'it worked!')

        assert.strictEqual(fn({}), defaultStr)
        assert.strictEqual(fn({foo:3}), defaultStr)
    })




    it('is independent of key ordering', () => {
        const two = rematch({ '{ y, x }': () => 'two params' })
        assert.strictEqual(two({ x: 3, y: 4 }), 'two params')
        assert.strictEqual(two({ y: 3, x: 4 }), 'two params')

        const three = rematch({ '{ x, y, z }': () => 'three params' })
        assert.strictEqual(three({ x: 3, y: 4, z: 5 }), 'three params')
        assert.strictEqual(three({ x: 3, z: 4, y: 5 }), 'three params')
        assert.strictEqual(three({ y: 3, x: 4, z: 5 }), 'three params')
        assert.strictEqual(three({ y: 3, z: 4, x: 5 }), 'three params')
        assert.strictEqual(three({ z: 3, x: 4, y: 5 }), 'three params')
        assert.strictEqual(three({ z: 3, y: 4, x: 5 }), 'three params')
    })
    it('works with trailing commas', () => {
        const fn = rematch({
            '{ x, }': () => hasX
            , '{ x, y, }': () => hasXandHasY
        })
        assert.strictEqual(fn({ x: 3 }), hasX)
        assert.strictEqual(fn({ x: 3, y: 4 }), hasXandHasY)
    })
    it('works with any key names', () => {
        const fn = rematch({ '{ foo, bar }': () => 'hello' })
        assert.strictEqual(fn({ foo: 3, bar: 4 }), 'hello')

        const fn2 = rematch({ '{ who, cares }': () => 'potato' })
        assert.strictEqual(fn2({ who: 3, cares: 4 }), 'potato')
    })
    it('works with default', () => {
        const fn = rematch({
            '{ foo, bar }': () => 'hello'
            , default: () => defaultStr
        })
        assert.strictEqual(fn({}), defaultStr)
        assert.strictEqual(fn({ foo: 0, bar: 0 }), 'hello')
        assert.strictEqual(fn(null), defaultStr)
        assert.strictEqual(fn(void 0), defaultStr)
    })
    it('does not work with null or undefined (on purpose)', () => {
        const fn = rematch({
            '{ foo, bar }': () => 'hello'
            , default: () => defaultStr
        })
        assert.strictEqual(fn(null), defaultStr)
        assert.strictEqual(fn(void 0), defaultStr)
    })
})
