import { EEEmail, EEIsikukood, EERegistrikood } from '@eametsad/types'
import { z } from 'zod'

// Wire shape produced by sealedIdentitySnapshot() in the sealed-bid panel:
// a JSON string carrying either an isikukood (private bidder) or a
// registrikood (company bidder), plus the shared contact fields.
const nonEmptyText = z.string().trim().min(1)

const identitySnapshotBase = {
  name: nonEmptyText,
  aadress: nonEmptyText,
  email: EEEmail,
  // The client form only requires a non-empty phone (no +372 format
  // check), so the server must not be stricter than the client here.
  telefon: nonEmptyText,
}

export const identitySnapshotObject = z.union([
  z.object({ ...identitySnapshotBase, isikukood: EEIsikukood }),
  z.object({ ...identitySnapshotBase, registrikood: EERegistrikood }),
])

export type IdentitySnapshot = z.infer<typeof identitySnapshotObject>

export type IdentitySnapshotParseResult =
  | { ok: true; snapshot: string }
  | { ok: false; error: string }

/**
 * Validates the identitySnapshot field of POST /api/v1/bids/create.
 * The field is optional; when present it must be the JSON string built by
 * the sealed-bid panel. On success the original string is returned so the
 * admission paths persist exactly what the client sent (encryption and
 * the column write are a later task).
 */
export function parseIdentitySnapshot(value: unknown): IdentitySnapshotParseResult {
  if (typeof value !== 'string') {
    return { ok: false, error: 'identitySnapshot must be a JSON string' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return { ok: false, error: 'identitySnapshot must contain valid JSON' }
  }
  const result = identitySnapshotObject.safeParse(parsed)
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue && issue.path.length > 0 ? ` at "${issue.path.join('.')}"` : ''
    const reason = issue ? issue.message : 'unknown validation error'
    return { ok: false, error: `Invalid identitySnapshot${where}: ${reason}` }
  }
  return { ok: true, snapshot: value }
}
