import { RepositoryError } from './errors'

export interface IsikukoodCodec {
  encrypt(text: string): { encrypted: string; iv: string; authTag: string }
  decrypt(encrypted: string, iv: string, authTag: string): string
  hash(value: string): string
}

/**
 * Port of the users collection beforeChange hook: a plaintext `isikukood`
 * becomes the four stored columns and never reaches the database as-is.
 */
export function applyIsikukoodOnWrite(
  data: Record<string, unknown>,
  codec: IsikukoodCodec,
): Record<string, unknown> {
  const raw = data.isikukood
  if (!raw) {
    return data
  }
  if (typeof raw !== 'string') {
    throw new RepositoryError(`isikukood must be a string, got ${typeof raw}`)
  }
  const { encrypted, iv, authTag } = codec.encrypt(raw)
  const out: Record<string, unknown> = { ...data }
  delete out.isikukood
  out.isikukoodEncrypted = encrypted
  out.isikukoodIv = iv
  out.isikukoodAuthTag = authTag
  out.isikukoodHash = codec.hash(raw)
  return out
}

/**
 * Port of the users collection afterRead hook: expose a virtual `isikukood`
 * when the stored columns allow decryption; on failure expose `undefined`
 * instead of failing the read.
 */
export function applyIsikukoodOnRead(
  doc: Record<string, unknown>,
  codec: IsikukoodCodec,
): Record<string, unknown> {
  const encrypted = doc.isikukoodEncrypted
  const iv = doc.isikukoodIv
  if (typeof encrypted !== 'string' || !encrypted || typeof iv !== 'string' || !iv) {
    return doc
  }
  const authTag = typeof doc.isikukoodAuthTag === 'string' ? doc.isikukoodAuthTag : ''
  let plaintext: string | undefined
  try {
    plaintext = codec.decrypt(encrypted, iv, authTag)
  } catch {
    plaintext = undefined
  }
  return { ...doc, isikukood: plaintext }
}

/**
 * Port of the contract-templates beforeChange hook condition: the swap runs
 * only when the next state is active and differs from the previous one.
 * On create, `previousActive` is undefined, so any active create swaps.
 */
export function shouldDeactivateOtherTemplates(
  previousActive: boolean | undefined,
  nextActive: boolean,
): boolean {
  return nextActive && nextActive !== previousActive
}
