import { describe, expect, it } from 'vitest'

import {
  applyIsikukoodOnRead,
  applyIsikukoodOnWrite,
  shouldDeactivateOtherTemplates,
  type IsikukoodCodec,
} from '../hooks'

const fakeCodec: IsikukoodCodec = {
  encrypt: (text) => ({ encrypted: `enc(${text})`, iv: `iv(${text})`, authTag: `tag(${text})` }),
  decrypt: (encrypted) => encrypted.slice(4, -1),
  hash: (value) => `hash(${value})`,
}

const failingCodec: IsikukoodCodec = {
  ...fakeCodec,
  decrypt: () => {
    throw new Error('bad key')
  },
}

describe('applyIsikukoodOnWrite', () => {
  it('encrypts a plaintext isikukood into the four stored columns', () => {
    const encoded = applyIsikukoodOnWrite({ email: 'a@b.ee', isikukood: '38001010000' }, fakeCodec)
    expect(encoded).toEqual({
      email: 'a@b.ee',
      isikukoodEncrypted: 'enc(38001010000)',
      isikukoodIv: 'iv(38001010000)',
      isikukoodAuthTag: 'tag(38001010000)',
      isikukoodHash: 'hash(38001010000)',
    })
  })

  it('never stores the plaintext isikukood', () => {
    const encoded = applyIsikukoodOnWrite({ isikukood: '38001010000' }, fakeCodec)
    expect('isikukood' in encoded).toBe(false)
  })

  it('leaves data without isikukood unchanged', () => {
    const data = { email: 'a@b.ee' }
    expect(applyIsikukoodOnWrite(data, fakeCodec)).toBe(data)
  })

  it('skips an empty isikukood', () => {
    const data = { email: 'a@b.ee', isikukood: '' }
    expect(applyIsikukoodOnWrite(data, fakeCodec)).toBe(data)
  })

  it('rejects a non-string isikukood', () => {
    expect(() => applyIsikukoodOnWrite({ isikukood: 38001010000 }, fakeCodec)).toThrow(
      /isikukood must be a string/,
    )
  })
})

describe('applyIsikukoodOnRead', () => {
  it('exposes a decrypted virtual isikukood', () => {
    const doc = applyIsikukoodOnRead(
      {
        id: 'u1',
        isikukoodEncrypted: 'enc(38001010000)',
        isikukoodIv: 'iv(38001010000)',
        isikukoodAuthTag: 'tag(38001010000)',
        isikukoodHash: 'hash(38001010000)',
      },
      fakeCodec,
    )
    expect(doc.isikukood).toBe('38001010000')
    expect(doc.isikukoodHash).toBe('hash(38001010000)')
  })

  it('returns the doc unchanged when encryption columns are absent', () => {
    const doc = { id: 'u1', email: 'a@b.ee' }
    expect(applyIsikukoodOnRead(doc, fakeCodec)).toBe(doc)
  })

  it('returns the doc unchanged without an iv', () => {
    const doc = { id: 'u1', isikukoodEncrypted: 'enc(x)' }
    expect(applyIsikukoodOnRead(doc, fakeCodec)).toBe(doc)
  })

  it('exposes undefined when decryption fails', () => {
    const doc = applyIsikukoodOnRead(
      { id: 'u1', isikukoodEncrypted: 'enc(38001010000)', isikukoodIv: 'iv(38001010000)', isikukoodAuthTag: 'tag(x)' },
      failingCodec,
    )
    expect(doc.isikukood).toBeUndefined()
  })
})

describe('shouldDeactivateOtherTemplates', () => {
  it('swaps on create with an active template', () => {
    expect(shouldDeactivateOtherTemplates(undefined, true)).toBe(true)
  })

  it('swaps when activating a previously inactive template', () => {
    expect(shouldDeactivateOtherTemplates(false, true)).toBe(true)
  })

  it('does not swap when already active', () => {
    expect(shouldDeactivateOtherTemplates(true, true)).toBe(false)
  })

  it('does not swap when deactivating', () => {
    expect(shouldDeactivateOtherTemplates(true, false)).toBe(false)
    expect(shouldDeactivateOtherTemplates(undefined, false)).toBe(false)
  })
})
