const assert = require('assert')
const wavematch = require('../src/index')


describe.only('matches objects', () => {
    const defaultStr = 'DEFAULTED'
    const hasX = 'has key x'
    const hasXandHasY = 'has keys x and y'
    const someVal = 'magic'

    it('works with zero keys at all - "{}"', () => {
        const fn = wavematch({
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
        const multiArg = wavematch({
            '_, {}': () => 'foo'
            , default: () => defaultStr
        })
        assert.strictEqual(multiArg(3, {}), 'foo')
        assert.strictEqual(multiArg({}),defaultStr)
    })

    it('works with exactly one named key - "{ x }"', () => {
        const fn = wavematch({
            '{ x }': () => hasX
            , default: () => defaultStr
        })
        assert.strictEqual(fn({ x: 3 }), hasX)
        assert.strictEqual(fn({}), defaultStr)
    })

    it('works with exactly two named keys - "{ x, y }"', () => {
        const fn = wavematch({
            '{ x, y }': () => hasXandHasY
            , default: () => defaultStr
        })
        assert.strictEqual(fn({ x: 3, y: 4 }), hasXandHasY)
        assert.strictEqual(fn({ x: 3 }), defaultStr)
        assert.strictEqual(fn({}), defaultStr)
    })

    // "{...}" zero or more
    it.only('works zero or more keys - "{...}"', () => {
        const fn = wavematch({
            '{ ... }': () => someVal
            , '{    ,...    }': () => someVal
            , '{    ,,...    }': () => someVal
            , '{    ...,    }': () => someVal
            , '{    ...,,    }': () => someVal
            , '{    ,...,    }': () => someVal
            , '{    ,,...,,    }': () => someVal
            , default: () => defaultStr
        })
        assert.strictEqual(fn({}), someVal)
        assert.strictEqual(fn({x:3}), someVal)
        assert.strictEqual(fn({x:3, y:4}), someVal)
        assert.strictEqual(fn({x:3, y:4, z:5}), someVal)

        assert.strictEqual(fn(void 0), defaultStr)
        assert.strictEqual(fn(()=>{}), defaultStr)
        assert.strictEqual(fn('foo'), defaultStr)
        assert.strictEqual(fn(null), defaultStr)
        assert.strictEqual(fn([]), defaultStr)
        assert.strictEqual(fn(1), defaultStr)
    })

    // exactly x and zero or more of any name
    it.only('works with at least one named key, and zero or more keys of any name - "{ x, ... }"', () => {
        const fn = wavematch({
            '{ x, ... }': () => someVal
            , '{x, ...}': () => someVal
            , '{x,...}': () => someVal
            , '{    x,...}': () => someVal
            , '{x,...    }': () => someVal
            , '{    x,...    }': () => someVal
            , default: () => defaultStr
        })
        assert.strictEqual(fn({x:3}), someVal)
        assert.strictEqual(fn({x:3, y:4}), someVal)
        assert.strictEqual(fn({x:3, y:4, z:5}), someVal)
        assert.strictEqual(fn({x:3, bar:1}), someVal)

        // Does NOT contained the desired named key `x`.
        assert.strictEqual(fn({}), defaultStr)
        assert.strictEqual(fn({foo:3}), defaultStr)
        assert.strictEqual(fn({foo:3, bar: 1}), defaultStr)

        const twoNamedKeys = wavematch({

        })
    })

    // exactly x, y, and zero or more of any name
    // exactly one of any name
    // exactly two of any name
    // exactly one of any name and zero or more of any name

    /*
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
    it('works with any key names', () => {
        const fn = wavematch({ '{ foo, bar }': () => 'hello' })
        assert.strictEqual(fn({ foo: 3, bar: 4 }), 'hello')

        const fn2 = wavematch({ '{ who, cares }': () => 'potato' })
        assert.strictEqual(fn2({ who: 3, cares: 4 }), 'potato')
    })
    it('works with default', () => {
        const fn = wavematch({
            '{ foo, bar }': () => 'hello'
            , default: () => defaultStr
        })
        assert.strictEqual(fn({}), defaultStr)
        assert.strictEqual(fn({ foo: 0, bar: 0 }), 'hello')
        assert.strictEqual(fn(null), defaultStr)
        assert.strictEqual(fn(void 0), defaultStr)
    })
    it('does not work with null or undefined (on purpose)', () => {
        const fn = wavematch({
            '{ foo, bar }': () => 'hello'
            , default: () => defaultStr
        })
        assert.strictEqual(fn(null), defaultStr)
        assert.strictEqual(fn(void 0), defaultStr)
    })
    */
})
