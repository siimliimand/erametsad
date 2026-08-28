import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { decrypt, encrypt } from '../crypto'
import { decryptSealedData, encryptSealedData } from '../encryption'
import { Users } from '../../payload/collections/Users'

const ISIKUKOOD_TEST_KEY = 'unit-test-isikukood-key'
const SEALED_TEST_KEY = 'unit-test-sealed-key'
const OTHER_KEY = 'unit-test-key-that-never-encrypted-anything'

const isikukoodKeyBackup = process.env.ISIKUKOOD_ENCRYPTION_KEY
const sealedKeyBackup = process.env.SEALED_BID_ENCRYPTION_KEY

function restoreEnv(name: string, backup: string | undefined) {
  if (backup === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = backup
  }
}

beforeAll(() => {
  process.env.ISIKUKOOD_ENCRYPTION_KEY = ISIKUKOOD_TEST_KEY
  process.env.SEALED_BID_ENCRYPTION_KEY = SEALED_TEST_KEY
})

afterAll(() => {
  restoreEnv('ISIKUKOOD_ENCRYPTION_KEY', isikukoodKeyBackup)
  restoreEnv('SEALED_BID_ENCRYPTION_KEY', sealedKeyBackup)
})

// Swap the first nibble so tampered values stay valid hex but change bytes.
function flipFirstHexNibble(hex: string): string {
  return (hex[0] === 'a' ? 'b' : 'a') + hex.slice(1)
}

describe('crypto encrypt/decrypt (isikukood)', () => {
  it('roundtrips the plaintext and returns a full envelope', () => {
    const plaintext = '38001298765'
    const envelope = encrypt(plaintext)

    expect(envelope.encrypted).toEqual(expect.any(String))
    expect(envelope.encrypted.length).toBeGreaterThan(0)
    expect(envelope.encrypted).not.toBe(plaintext)
    expect(envelope.iv.length).toBeGreaterThan(0)
    expect(envelope.authTag.length).toBeGreaterThan(0)

    expect(decrypt(envelope.encrypted, envelope.iv, envelope.authTag)).toBe(plaintext)
  })

  it('throws on tampered ciphertext instead of returning wrong plaintext', () => {
    const envelope = encrypt('38001298765')
    const tampered = flipFirstHexNibble(envelope.encrypted)

    expect(() => decrypt(tampered, envelope.iv, envelope.authTag)).toThrow()
  })

  it('throws on a tampered authTag', () => {
    const envelope = encrypt('38001298765')
    const tamperedTag = flipFirstHexNibble(envelope.authTag)

    expect(() => decrypt(envelope.encrypted, envelope.iv, tamperedTag)).toThrow()
  })

  it('throws when decrypting with a different key', () => {
    const envelope = encrypt('38001298765')

    try {
      process.env.ISIKUKOOD_ENCRYPTION_KEY = OTHER_KEY
      expect(() => decrypt(envelope.encrypted, envelope.iv, envelope.authTag)).toThrow()
    } finally {
      process.env.ISIKUKOOD_ENCRYPTION_KEY = ISIKUKOOD_TEST_KEY
    }
  })

  it('throws when the authTag is empty', () => {
    const envelope = encrypt('38001298765')

    expect(() => decrypt(envelope.encrypted, envelope.iv, '')).toThrow(/authTag is required/)
  })
})

describe('encryption encryptSealedData/decryptSealedData (sealed bids)', () => {
  it('roundtrips the amount and the identity snapshot', () => {
    const amount = '12500'
    const snapshot = JSON.stringify({ userId: 'user-1', name: 'Mets OÜ' })

    const amountEnvelope = encryptSealedData(amount)
    const snapshotEnvelope = encryptSealedData(snapshot)

    expect(amountEnvelope.encrypted).not.toBe(amount)
    expect(amountEnvelope.authTag.length).toBeGreaterThan(0)
    expect(snapshotEnvelope.authTag.length).toBeGreaterThan(0)

    expect(decryptSealedData(amountEnvelope.encrypted, amountEnvelope.iv, amountEnvelope.authTag)).toBe(amount)
    expect(
      decryptSealedData(snapshotEnvelope.encrypted, snapshotEnvelope.iv, snapshotEnvelope.authTag),
    ).toBe(snapshot)
  })

  it('throws on tampered ciphertext instead of returning wrong plaintext', () => {
    const envelope = encryptSealedData('12500')
    const tampered = flipFirstHexNibble(envelope.encrypted)

    expect(() => decryptSealedData(tampered, envelope.iv, envelope.authTag)).toThrow()
  })

  it('throws on a tampered authTag', () => {
    const envelope = encryptSealedData('12500')
    const tamperedTag = flipFirstHexNibble(envelope.authTag)

    expect(() => decryptSealedData(envelope.encrypted, envelope.iv, tamperedTag)).toThrow()
  })

  it('throws when decrypting with a different key', () => {
    const envelope = encryptSealedData('12500')

    try {
      process.env.SEALED_BID_ENCRYPTION_KEY = OTHER_KEY
      expect(() => decryptSealedData(envelope.encrypted, envelope.iv, envelope.authTag)).toThrow()
    } finally {
      process.env.SEALED_BID_ENCRYPTION_KEY = SEALED_TEST_KEY
    }
  })

  it('throws when the authTag is empty', () => {
    const envelope = encryptSealedData('12500')

    expect(() => decryptSealedData(envelope.encrypted, envelope.iv, '')).toThrow(/authTag is required/)
  })
})

type UsersAfterReadHook = (data: { doc: Record<string, unknown> }) => {
  doc: Record<string, unknown>
}
type UsersBeforeChangeHook = (data: { data?: Record<string, unknown> }) => {
  data?: Record<string, unknown>
}

const afterReadHook = Users.hooks?.afterRead?.[0] as unknown as UsersAfterReadHook
const beforeChangeHook = Users.hooks?.beforeChange?.[0] as unknown as UsersBeforeChangeHook

describe('Users afterRead hook on encrypted isikukood', () => {
  it('returns the plaintext isikukood when the envelope is intact', () => {
    const isikukood = '38001298765'
    const envelope = encrypt(isikukood)

    let outcome: { doc: Record<string, unknown> } | undefined
    expect(() => {
      outcome = afterReadHook({
        doc: {
          id: 'user-1',
          email: 'mets@example.ee',
          isikukoodEncrypted: envelope.encrypted,
          isikukoodIv: envelope.iv,
          isikukoodAuthTag: envelope.authTag,
        },
      })
    }).not.toThrow()

    expect(outcome?.doc.isikukood).toBe(isikukood)
    expect(outcome?.doc.email).toBe('mets@example.ee')
  })

  it('never throws and omits the isikukood when the authTag is missing', () => {
    const envelope = encrypt('38001298765')

    let outcome: { doc: Record<string, unknown> } | undefined
    expect(() => {
      outcome = afterReadHook({
        doc: {
          isikukoodEncrypted: envelope.encrypted,
          isikukoodIv: envelope.iv,
        },
      })
    }).not.toThrow()

    expect(outcome?.doc.isikukood).toBeUndefined()
  })

  it('never throws and omits the isikukood when the ciphertext is tampered', () => {
    const envelope = encrypt('38001298765')
    const tampered = flipFirstHexNibble(envelope.encrypted)

    let outcome: { doc: Record<string, unknown> } | undefined
    expect(() => {
      outcome = afterReadHook({
        doc: {
          isikukoodEncrypted: tampered,
          isikukoodIv: envelope.iv,
          isikukoodAuthTag: envelope.authTag,
        },
      })
    }).not.toThrow()

    expect(outcome?.doc.isikukood).toBeUndefined()
  })

  it('never throws and omits the isikukood when the key does not match', () => {
    const envelope = encrypt('38001298765')

    try {
      process.env.ISIKUKOOD_ENCRYPTION_KEY = OTHER_KEY
      let outcome: { doc: Record<string, unknown> } | undefined
      expect(() => {
        outcome = afterReadHook({
          doc: {
            isikukoodEncrypted: envelope.encrypted,
            isikukoodIv: envelope.iv,
            isikukoodAuthTag: envelope.authTag,
          },
        })
      }).not.toThrow()

      expect(outcome?.doc.isikukood).toBeUndefined()
    } finally {
      process.env.ISIKUKOOD_ENCRYPTION_KEY = ISIKUKOOD_TEST_KEY
    }
  })

  it('roundtrips the isikukood through beforeChange and afterRead', () => {
    const isikukood = '48005091121'

    const changed = beforeChangeHook({ data: { email: 'mets@example.ee', isikukood } })
    expect(changed.data?.isikukood).toBeUndefined()
    expect(changed.data?.isikukoodEncrypted).toEqual(expect.any(String))
    expect(changed.data?.isikukoodIv).toEqual(expect.any(String))
    expect(changed.data?.isikukoodAuthTag).toEqual(expect.any(String))
    expect(changed.data?.isikukoodHash).toEqual(expect.any(String))

    const read = afterReadHook({ doc: { ...(changed.data ?? {}) } })
    expect(read.doc.isikukood).toBe(isikukood)
  })
})
