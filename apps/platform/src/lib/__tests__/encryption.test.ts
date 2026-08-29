import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { Users } from '../../payload/collections/Users'
import {
  signAccessToken,
  signAccessTokenAsync,
  signRefreshTokenAsync,
  verifyAccessToken,
  verifyAccessTokenAsync,
  verifyRefreshTokenAsync,
} from '../auth/jwt'
import { computeIpHash, computeIpHashAsync } from '../bidding/place-bid'
import { decrypt, encrypt } from '../crypto'
import {
  decryptSealedData,
  decryptSealedDataAsync,
  encryptSealedData,
  encryptSealedDataAsync,
} from '../encryption'

process.env.JWT_SECRET ??= 'test-jwt-secret'

const ISIKUKOOD_TEST_KEY = 'unit-test-isikukood-key'
const SEALED_TEST_KEY = 'unit-test-sealed-key'
const OTHER_KEY = 'unit-test-key-that-never-encrypted-anything'

const isikukoodKeyBackup = process.env.ISIKUKOOD_ENCRYPTION_KEY
const sealedKeyBackup = process.env.SEALED_BID_ENCRYPTION_KEY

function restoreEnv(name: string, backup: string | undefined) {
  if (backup === undefined) {
    Reflect.deleteProperty(process.env, name)
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
  return (hex.startsWith('a') ? 'b' : 'a') + hex.slice(1)
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

// Task 5.2: the Workers-native crypto.subtle paths must stay byte-compatible
// with the sync node:crypto bridges so callers can migrate piecemeal.
describe('web-crypto port interop (task 5.2)', () => {
  it('roundtrips through encryptSealedDataAsync/decryptSealedDataAsync', async () => {
    const envelope = await encryptSealedDataAsync('12500')

    expect(envelope.encrypted).not.toBe('12500')
    expect(envelope.authTag).toHaveLength(32)
    expect(await decryptSealedDataAsync(
      envelope.encrypted,
      envelope.iv,
      envelope.authTag,
    )).toBe('12500')
  })

  it('decrypts an async envelope with the sync bridge', async () => {
    const envelope = await encryptSealedDataAsync('{"userId":"user-1"}')

    expect(decryptSealedData(envelope.encrypted, envelope.iv, envelope.authTag)).toBe(
      '{"userId":"user-1"}',
    )
  })

  it('decrypts a sync envelope with the async path', async () => {
    const envelope = encryptSealedData('12500')

    await expect(
      decryptSealedDataAsync(envelope.encrypted, envelope.iv, envelope.authTag),
    ).resolves.toBe('12500')
  })

  it('async decrypt throws on tampered ciphertext and tampered authTag', async () => {
    const envelope = await encryptSealedDataAsync('12500')

    await expect(decryptSealedDataAsync(
      flipFirstHexNibble(envelope.encrypted),
      envelope.iv,
      envelope.authTag,
    )).rejects.toThrow()

    await expect(decryptSealedDataAsync(
      envelope.encrypted,
      envelope.iv,
      flipFirstHexNibble(envelope.authTag),
    )).rejects.toThrow()
  })

  it('async decrypt throws with a different key and on an empty authTag', async () => {
    const envelope = await encryptSealedDataAsync('12500')

    try {
      process.env.SEALED_BID_ENCRYPTION_KEY = OTHER_KEY
      await expect(
        decryptSealedDataAsync(envelope.encrypted, envelope.iv, envelope.authTag),
      ).rejects.toThrow()
    } finally {
      process.env.SEALED_BID_ENCRYPTION_KEY = SEALED_TEST_KEY
    }

    await expect(
      decryptSealedDataAsync(envelope.encrypted, envelope.iv, ''),
    ).rejects.toThrow(/authTag is required/)
  })

  it('roundtrips an access token signed and verified with crypto.subtle', async () => {
    const token = await signAccessTokenAsync({
      userId: 'user-async',
      role: 'private',
      sessionId: 'session-1',
    })

    expect(await verifyAccessTokenAsync(token)).toMatchObject({
      userId: 'user-async',
      role: 'private',
      sessionId: 'session-1',
    })
  })

  it('verifies an async-signed token with the sync bridge and vice versa', async () => {
    const asyncToken = await signAccessTokenAsync({ userId: 'user-x', role: 'private' })
    expect(verifyAccessToken(asyncToken)).toMatchObject({ userId: 'user-x' })

    const syncToken = signAccessToken({ userId: 'user-y', role: 'admin' })
    expect(await verifyAccessTokenAsync(syncToken)).toMatchObject({ userId: 'user-y' })
  })

  it('async refresh roundtrip and async verify rejection of tampering', async () => {
    const token = await signRefreshTokenAsync({ sessionId: 'session-r', jti: 'jti-1' })
    expect(await verifyRefreshTokenAsync(token)).toEqual({ sessionId: 'session-r' })

    const parts = token.split('.')
    const sig = parts[2] ?? ''
    parts[2] = sig.endsWith('A') ? `${sig.slice(0, -1)}B` : `${sig.slice(0, -1)}A`
    expect(await verifyAccessTokenAsync(parts.join('.'))).toBeNull()
    expect(await verifyAccessTokenAsync('not-a-jwt')).toBeNull()
  })

  it('computeIpHashAsync matches the sync computeIpHash digest', async () => {
    expect(await computeIpHashAsync('203.0.113.7')).toBe(computeIpHash('203.0.113.7'))
    expect(computeIpHash('203.0.113.7')).toMatch(/^[0-9a-f]{64}$/)
  })
})

type UsersAfterReadHook = (data: { doc: Record<string, unknown> }) => Record<string, unknown>
type UsersBeforeChangeHook = (data: { data: Record<string, unknown> }) => Record<string, unknown>

const afterReadHook = Users.hooks.afterRead[0] as unknown as UsersAfterReadHook
const beforeChangeHook = Users.hooks.beforeChange[0] as unknown as UsersBeforeChangeHook

describe('Users afterRead hook on encrypted isikukood', () => {
  it('returns the plaintext isikukood when the envelope is intact', () => {
    const isikukood = '38001298765'
    const envelope = encrypt(isikukood)

    let outcome: Record<string, unknown> | undefined
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

    expect(outcome?.isikukood).toBe(isikukood)
    expect(outcome?.email).toBe('mets@example.ee')
  })

  it('never throws and omits the isikukood when the authTag is missing', () => {
    const envelope = encrypt('38001298765')

    let outcome: Record<string, unknown> | undefined
    expect(() => {
      outcome = afterReadHook({
        doc: {
          isikukoodEncrypted: envelope.encrypted,
          isikukoodIv: envelope.iv,
        },
      })
    }).not.toThrow()

    expect(outcome?.isikukood).toBeUndefined()
  })

  it('never throws and omits the isikukood when the ciphertext is tampered', () => {
    const envelope = encrypt('38001298765')
    const tampered = flipFirstHexNibble(envelope.encrypted)

    let outcome: Record<string, unknown> | undefined
    expect(() => {
      outcome = afterReadHook({
        doc: {
          isikukoodEncrypted: tampered,
          isikukoodIv: envelope.iv,
          isikukoodAuthTag: envelope.authTag,
        },
      })
    }).not.toThrow()

    expect(outcome?.isikukood).toBeUndefined()
  })

  it('never throws and omits the isikukood when the key does not match', () => {
    const envelope = encrypt('38001298765')

    try {
      process.env.ISIKUKOOD_ENCRYPTION_KEY = OTHER_KEY
      let outcome: Record<string, unknown> | undefined
      expect(() => {
        outcome = afterReadHook({
          doc: {
            isikukoodEncrypted: envelope.encrypted,
            isikukoodIv: envelope.iv,
            isikukoodAuthTag: envelope.authTag,
          },
        })
      }).not.toThrow()

      expect(outcome?.isikukood).toBeUndefined()
    } finally {
      process.env.ISIKUKOOD_ENCRYPTION_KEY = ISIKUKOOD_TEST_KEY
    }
  })

  it('roundtrips the isikukood through beforeChange and afterRead', () => {
    const isikukood = '48005091121'

    const changed = beforeChangeHook({ data: { email: 'mets@example.ee', isikukood } })
    expect(changed.isikukood).toBeUndefined()
    expect(changed.isikukoodEncrypted).toEqual(expect.any(String))
    expect(changed.isikukoodIv).toEqual(expect.any(String))
    expect(changed.isikukoodAuthTag).toEqual(expect.any(String))
    expect(changed.isikukoodHash).toEqual(expect.any(String))

    const read = afterReadHook({ doc: { ...changed } })
    expect(read.isikukood).toBe(isikukood)
  })
})
