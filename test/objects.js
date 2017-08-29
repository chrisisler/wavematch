const assert = require('assert')
const wavematch = require('../src/index')

// Note: `N` is greater than zero.

const someValue = 'magic'
const fallback = 'DEFAULTED'

describe('matches objects', () => {

    otherTests() // see bottom

    describe('without "..."', () => {
        it('zero named keys && zero unnamed keys', () => {
            const zeroKeys = wavematch({
                '{}'            : someValue
                , '   {   }   ' : someValue
                , default       : fallback
            })
            // assert.strictEqual(zeroKeys({}), someValue)

            // assert.strictEqual(zeroKeys({ someKey: 1 }), fallback)
            // assert.strictEqual(zeroKeys({ someKey: 1 , other: 1 }), fallback)
        })

        it('N named keys && N unnamed keys', () => {
            const namedXYAndUnnamedKey = 'named x and y keys, unnamed key'
            const namedXAndUnnamedKey = 'named key: x, unnamed key'
            const namedZAndTwoUnnamedKeys = 'named key: z, two unnamed keys'

            const bothKeys = wavematch({
                '{ x, y, _, }'  : namedXYAndUnnamedKey
                , '{ x, _ }'    : namedXAndUnnamedKey
                , '{ z, _, _ }' : namedZAndTwoUnnamedKeys
                , default       : fallback
            })

            assert.strictEqual(bothKeys({ x: 1, foo: 1 }), namedXAndUnnamedKey)
            assert.strictEqual(bothKeys({ x: 1, y: 1 }), namedXAndUnnamedKey)
            assert.strictEqual(bothKeys({ x: 1, y: 1, foo: 1 }), namedXYAndUnnamedKey)
            assert.strictEqual(bothKeys({ z: 1, bar: 1, foo: 1 }), namedZAndTwoUnnamedKeys)

            // works
            assert.strictEqual(bothKeys({}), fallback)
            assert.strictEqual(bothKeys({ foo: 1 }), fallback)
            assert.strictEqual(bothKeys({ bar: 1 }), fallback)
            assert.strictEqual(bothKeys({ x: 1 }), fallback)
            assert.strictEqual(bothKeys({ z: 1, foo: 1 }), fallback)
        })

        it('N named keys && zero unnamed keys', () => {
            const x = 'x'
            const xy = 'xy'
            const xyz = 'xyz'
            const onlyNamedKeys = wavematch({
                '{ x }'         : x
                , '{ x, y, }'   : xy
                , '{ x, y, z }' : xyz
                , default       : fallback
            })

            assert.strictEqual(onlyNamedKeys({ x: 1 }), x)
            assert.strictEqual(onlyNamedKeys({ x: 1, y: 1 }), xy)
            assert.strictEqual(onlyNamedKeys({ x: 1, y: 1, z: 1 }), xyz)

            assert.strictEqual(onlyNamedKeys({}), fallback)
            assert.strictEqual(onlyNamedKeys({ z: 1 }), fallback)
            assert.strictEqual(onlyNamedKeys({ y: 1 }), fallback)
            assert.strictEqual(onlyNamedKeys({ y: 1, z: 1 }), fallback)
        })

        it('zero named keys && N unnamed keys', () => {
            const onlyUnnamedKeys = wavematch({
                '{ _ }'         : 'one'
                , '{ _, _ }'    : 'two'
                , '{ _, _, _ }' : 'three'
                , default       : fallback
            })

            assert.strictEqual(onlyUnnamedKeys({ x: 1 }), 'one')
            assert.strictEqual(onlyUnnamedKeys({ x: 1, y: 1 }), 'two')
            assert.strictEqual(onlyUnnamedKeys({ x: 1, y: 1, z: 1 }), 'three')

            assert.strictEqual(onlyUnnamedKeys({}), fallback)
            assert.strictEqual(onlyUnnamedKeys({ a: 1, b: 2, c: 3, d: 4 }), fallback)
        })
    })

    describe('with "..."', () => {
        it('zero named keys && zero unnamed keys', () => {
            //test if each desired key matches the input obj
            const bothZeroKeys = wavematch({
                '{...}'                : 'neither'
                , '   {   ...    }   ' : 'neither'
                , default              : fallback
            })
            assert.strictEqual(bothZeroKeys({}), 'neither')

            // This case contains no `default` key because '{...}' will match any object ever.
            assert.strictEqual(bothZeroKeys({ foo: 3 }), 'neither')
        })

        it('at least N named keys && at least N unnamed keys', () => {
            // Where there is at least one named key and at least one unnamed key.
            const zeroOrMoreOfBothKeys = wavematch({
                '{ age, id, name, _, _, _, ... }' : 'three'
                , '{ age, id, name, _, _, ... }'  : 'three named, two unnamed'
                , '{ age, id, _, _, ... }'        : 'two'
                , '{ age, id, _, ... }'           : 'two named, one unnamed'
                , '{ age, _, ... }'               : 'one'
                , default: fallback
            })

            // only "one" pair of named && unnamed keys (in the input object under test)
            assert.strictEqual(zeroOrMoreOfBothKeys({ age: 1, foo: 1 }), 'one')
            assert.strictEqual(zeroOrMoreOfBothKeys({ age: 1, foo: 1, bar: 1 }), 'one') // extra keys don't need specific names

            // "two" pairs of named && unnamed keys (in the input object under test)
            assert.strictEqual(zeroOrMoreOfBothKeys({ age: 1, id: 1, foo: 1, bar: 1 }), 'two')
            assert.strictEqual(zeroOrMoreOfBothKeys({ age: 1, id: 1, foo: 1, bar: 1, whatever: 1 }), 'two')

            // "three" pairs of named && unnamed keys (in the input object under test)
            assert.strictEqual(zeroOrMoreOfBothKeys({ age: 1, id: 1, name: 'andy', foo: 1, bar: 1, baz: 1 }), 'three')
            assert.strictEqual(zeroOrMoreOfBothKeys({ age: 1, id: 1, name: 'andy', foo: 1, bar: 1, baz: 1, whatever: 1 }), 'three')
        })

        // This case (and its "unnamed" equivalent, below) are especially difficult
        // because having '{ x, ... }' overrides matches for '{ x, y, ... }' too,
        // even though the latter is _more_ specific. Obviously, the implementation
        // logic must accommodate for this potential pitfall (noted 2017-8-28).
        it('at least N named keys && zero unnamed keys', () => {
            const oneOrMoreNamedKeys = wavematch({
                '{ todos, ... }': 'one key or more'
                , '{ todos, store, ... }': 'two keys or more'
                , '{ todos, store, redux, ... }': 'three keys or more'
                , default: fallback
            })

            assert.strictEqual(oneOrMoreNamedKeys({ todos: 1 }), 'one key or more')
            assert.strictEqual(oneOrMoreNamedKeys({ todos: 1, foo: 1 }), 'one key or more')

            assert.strictEqual(oneOrMoreNamedKeys({ todos: 1, store: 1 }), 'two keys or more')
            assert.strictEqual(oneOrMoreNamedKeys({ todos: 1, store: 1, foo: 1 }), 'two keys or more')

            assert.strictEqual(oneOrMoreNamedKeys({ todos: 1, store: 1, redux: 1 }), 'three keys or more')
            assert.strictEqual(oneOrMoreNamedKeys({ todos: 1, store: 1, redux: 1, foo: 1 }), 'three keys or more')
        })

        it('zero named keys && at least N unnamed keys', () => {
            // If arg keys are length N, return true if there are some unnamed keys of the same length
            const oneOrMoreUnnamedKeys = wavematch({
                '{ _, ... }': 'one key or more'
                , '{ _, _, ... }': 'two keys or more'
                , '{ _, _, _, ... }': 'three keys or more'
                , default: fallback
            })

            assert.strictEqual(oneOrMoreUnnamedKeys({ x: 1 }), 'one key or more')
            assert.strictEqual(oneOrMoreUnnamedKeys({ x: 1, y: 1 }), 'two keys or more')
            assert.strictEqual(oneOrMoreUnnamedKeys({ x: 1, y: 1, z: 1 }), 'three keys or more')

            assert.strictEqual(oneOrMoreUnnamedKeys({}), fallback)
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
            '{ x, }': () => 'x'
            , '{ x, y, }': () => 'xy'
        })
        assert.strictEqual(fn({ x: 3 }), 'x')
        assert.strictEqual(fn({ x: 3, y: 4 }), 'xy')
    })
    it('does not work with null or undefined (on purpose)', () => {
        const fn = wavematch({
            '{ foo, bar }': () => 'hello'
            , default: () => fallback
        })
        assert.strictEqual(fn(null), fallback)
        assert.strictEqual(fn(void 0), fallback)
    })
}
