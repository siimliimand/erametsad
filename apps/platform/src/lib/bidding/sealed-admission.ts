import type { CoreRepositories } from '../data/repositories'
import { encryptSealedDataAsync } from '../encryption'

// Matches the settings schema default (sealed_revision_cap) and the legacy
// sealed-bid fallback: one initial bid plus N revisions per user.
export const SEALED_REVISION_CAP_DEFAULT = 3

/**
 * Sealed rows never store a readable amount: the row keeps amount_cents 0
 * and the real amount travels inside the encrypted envelope, so hot state,
 * SSE, and the ceremony all stay key-gated.
 */
export function sealedStorageAmountCents(
  type: 'open' | 'sealed',
  amountCents: number,
): number {
  return type === 'sealed' ? 0 : amountCents
}

export function resolveSealedRevisionCap(
  settings: Record<string, unknown> | null | undefined,
): number {
  const raw = settings?.sealedRevisionCap
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Math.floor(raw)
  }
  return SEALED_REVISION_CAP_DEFAULT
}

export function sealedRevisionCapMessage(cap: number): string {
  return `Lukspakkumuste limiit on ületatud: lubatud on üks esialgne pakkumine ja kuni ${String(cap)} täienduspakkumist`
}

/**
 * Prior sealed bids (every status except rejected) the user already holds
 * on the auction. Both admission call sites compare this against
 * 1 + resolveSealedRevisionCap(settings) in the same turn that appends
 * the bid.
 */
export async function countUserSealedBids(
  repos: CoreRepositories,
  auctionId: string,
  userId: string,
): Promise<number> {
  const result = await repos.find({
    collection: 'bids',
    where: {
      and: [
        { auction: { equals: auctionId } },
        { user: { equals: userId } },
        { type: { equals: 'sealed' } },
        { status: { not_equals: 'rejected' } },
      ],
    },
    limit: 1000,
  })
  return result.docs.length
}

/**
 * The identity_snapshot column value for a sealed bid: AES-256-GCM
 * envelopes for the amount and, when present, the identity snapshot.
 * Envelope keys match decryptSealedBids, so the opening ceremony reads
 * rows from both admission paths without a separate branch.
 */
export async function buildSealedIdentitySnapshot(
  amount: number,
  identitySnapshot?: string,
): Promise<string> {
  const amountEnvelope = await encryptSealedDataAsync(String(amount))
  const payload: Record<string, string> = {
    encrypted: amountEnvelope.encrypted,
    iv: amountEnvelope.iv,
    authTag: amountEnvelope.authTag,
  }
  if (identitySnapshot !== undefined) {
    const identityEnvelope = await encryptSealedDataAsync(identitySnapshot)
    payload.identityEncrypted = identityEnvelope.encrypted
    payload.identityIv = identityEnvelope.iv
    payload.identityAuthTag = identityEnvelope.authTag
  }
  return JSON.stringify(payload)
}
