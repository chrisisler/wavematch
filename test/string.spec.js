const assert = require('assert')
const wavematch = require('../lib/wavematch.js')
const { accept, reject, eq } = require('./shared.js')

describe('wavematch string specification', () => {
  it('should match String constructor', () => {
    eq(wavematch('i am a string')(
      (str = String) => accept,
      _ => reject
    ), accept)

    eq(wavematch('foo')(
      (str = 'bar') => reject,
      _ => accept
    ), accept)

    eq(wavematch('lmao')(
      (str = '') => reject,
      (str = String) => accept,
      _ => reject
    ), accept)

    eq(wavematch('foo')(
      (str = 'a') => reject,
      (str = String) => reject,
      (str = 'foo') => accept,
      _ => reject
    ), accept)
  })

  it('should match case-sensitive strings', () => {
    eq(wavematch('foo')(
      (str = 'Foo') => reject,
      (str = 'fOo') => reject,
      (str = 'FoO') => reject,
      (str = 'foo') => accept,
      _ => reject
    ), accept)
  })

  it('should match empty string', () => {
    let empty = (string, acceptOrReject) => eq(wavematch(string)(
      (str = '') => accept,
      _ => reject
    ), acceptOrReject)

    empty('', accept)
    empty(String(), accept)
    empty(String(''), accept)

    empty(new String(), accept)
    empty(new String(''), accept)
  })
})
