// Task 5.2: computeIpHashAsync is the canonical crypto.subtle path used by
// the bid flow. The sync computeIpHash stays on node:crypto because the
// leads route and the local vitest node pool still call it synchronously;
// both produce the same salted SHA-256 hex digest.
import { createHash } from 'node:crypto'

import { isAlapakkumineEnabled } from './alapakkumine'
import {
  buildSealedIdentitySnapshot,
  countUserSealedBids,
  resolveSealedRevisionCap,
  sealedRevisionCapMessage,
  sealedStorageAmountCents,
} from './sealed-admission'
import type { CoreRepositories } from '../data/repositories'
import { centsToEuros, eurosToCents } from '../data/repositories/money'
import type { RepositorySlug } from '../data/repositories/registry'
import { getRepositories } from '../data/runtime'
import { db, type SqlStatement } from '../db'
import { type DomainEvent, eventBus } from '../notifications/event-bus'

export interface PlaceBidParams {
  userId: string
  auctionId: string
  amount: number
  type: 'open' | 'sealed'
  source: 'manual' | 'autobidder'
  requestIp?: string
  idempotencyKey?: string
  /** Validated identity snapshot (JSON string) forwarded by the bids/create route. */
  identitySnapshot?: string
}

export interface BidSuccess {
  success: true
  bid: Record<string, unknown>
}

export interface BidError {
  success: false
  error: string
  status: number
  code?: 'framework_contract_required' | 'revision_cap_exceeded'
  redirectUrl?: string
}

export type BidResult = BidSuccess | BidError

const IP_HASH_SALT = process.env.PAYLOAD_SECRET ?? 'dev-ip-hash-salt'

export function computeIpHash(ip: string): string {
  return createHash('sha256')
    .update(`${IP_HASH_SALT}:${ip}`)
    .digest('hex')
}

export async function computeIpHashAsync(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${IP_HASH_SALT}:${ip}`),
  )
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')
}

function normalizeRequestIp(headerValue: string | undefined): string {
  const first = headerValue?.split(',')[0]?.trim()
  return first && first.length > 0 ? first : 'unknown'
}

// Bid writes previously ran inside a Postgres transaction guarded by
// SELECT ... FOR UPDATE on the auction row (withAuctionLock). That lock is
// deleted: the AuctionDO durable object serialises bid writes per auction
// from task 3.2. Until then every UPDATE carries a status guard and
// multi-statement writes go through one atomic D1 batch.
export function bidStatusUpdateStatement(
  id: string,
  from: string,
  to: string,
  now: string,
): SqlStatement {
  return {
    sql: 'update bids set status = ?, updated_at = ? where id = ? and status = ?',
    params: [to, now, id, from],
  }
}

type BidFlowCollection = Extract<
  RepositorySlug,
  'users' | 'auctions' | 'auction-rights' | 'settings' | 'contract-templates' | 'contracts' | 'bids'
>

async function findDoc(
  repos: CoreRepositories,
  collection: BidFlowCollection,
  where: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const result = await repos.find({
    collection,
    where: where as never,
    limit: 1,
  })
  return (result.docs[0] as Record<string, unknown> | undefined) ?? null
}

export async function placeBid(params: PlaceBidParams): Promise<BidResult> {
  const { userId, auctionId, amount, type, source, requestIp, idempotencyKey } =
    params

  const repos = await getRepositories()
  const events: DomainEvent[] = []
  const ipHash =
    requestIp !== undefined
      ? await computeIpHashAsync(normalizeRequestIp(requestIp))
      : undefined
  const now = new Date().toISOString()

  const runBidFlow = async (): Promise<BidResult> => {
    // 1. Verify user exists
    const user = await findDoc(repos, 'users', { id: { equals: userId } })
    if (!user) {
      return { success: false, error: 'User not found', status: 401 }
    }
    if (user.status === 'suspended') {
      return { success: false, error: 'User is suspended', status: 403 }
    }

    // 2. Auction is active
    const auction = await findDoc(repos, 'auctions', {
      id: { equals: auctionId },
    })
    if (!auction) {
      return { success: false, error: 'Auction not found', status: 404 }
    }
    if (auction.status !== 'active') {
      return { success: false, error: 'Auction is not active', status: 400 }
    }
    const endsAt = auction.endsAt as string | undefined
    if (!endsAt || new Date(endsAt) <= new Date()) {
      return { success: false, error: 'Auction has ended', status: 400 }
    }

    const objectType = auction.objectType as string
    const minBidCents = auction.minBidCents as number
    const minBid = centsToEuros(minBidCents)
    const auctionTitle =
      (auction.title as string | undefined) ?? `Auction ${auctionId}`

    // 3. ObjectType right
    const right = await findDoc(repos, 'auction-rights', {
      and: [
        { user: { equals: userId } },
        { objectType: { equals: objectType } },
        { revokedAt: { exists: false } },
      ],
    })
    if (!right) {
      return {
        success: false,
        error: 'No bidding right for this object type',
        status: 403,
      }
    }

    // 4. Settings: alapakkumine flag and the framework-contract gate flag
    const settings = await findDoc(repos, 'settings', {})
    const featureFlags: Record<string, unknown> = settings?.featureFlags
      ? (settings.featureFlags as Record<string, unknown>)
      : {}
    // Gate is active by default; only an explicit false disables it (demo override).
    const gateDisabledBySettings =
      featureFlags.requireFrameworkContract === false

    // 5. Amount validity: below minBid is only legal as an alapakkumine
    //    request (pending_approval), and only when Settings enable it.
    const isUnderStartBid = eurosToCents(amount) < minBidCents
    if (isUnderStartBid && !isAlapakkumineEnabled(settings)) {
      return {
        success: false,
        error: `Bid must be at least ${String(minBid)} EUR`,
        status: 400,
      }
    }

    // 6. Step validation against the current leader (normal path only)
    let leadingBid: Record<string, unknown> | null = null
    if (!isUnderStartBid) {
      leadingBid = await findDoc(repos, 'bids', {
        and: [
          { auction: { equals: auctionId } },
          { status: { equals: 'leading' } },
        ],
      })
      if (leadingBid) {
        const leadingAmount = centsToEuros(leadingBid.amountCents as number)
        const auctionBidStepCents = auction.bidStepCents as number | null
        const bidStep = auctionBidStepCents === null ? 0 : centsToEuros(auctionBidStepCents)
        const minimumAmount = leadingAmount + bidStep
        if (amount < minimumAmount) {
          return {
            success: false,
            error: `Bid must be at least ${String(minimumAmount)} EUR`,
            status: 400,
          }
        }
      }
    }

    // 7. Framework contract gate (open auctions, active by default)
    if (type === 'open' && !gateDisabledBySettings) {
      const template = await findDoc(repos, 'contract-templates', {
        and: [{ type: { equals: 'framework' } }, { active: { equals: true } }],
      })
      if (template) {
        const signed = await findDoc(repos, 'contracts', {
          and: [
            { signedBy: { equals: userId } },
            { status: { equals: 'signed' } },
            { template: { equals: template.id } },
          ],
        })
        if (!signed) {
          return {
            success: false,
            error: 'Framework contract required',
            status: 403,
            code: 'framework_contract_required',
            redirectUrl: '/lepingud/raamleping',
          }
        }
      }
    }

    // 8. Idempotency check
    if (idempotencyKey) {
      const existing = await findDoc(repos, 'bids', {
        idempotencyKey: { equals: idempotencyKey },
      })
      if (existing) {
        return {
          success: false,
          error: 'Duplicate bid (idempotency key already used)',
          status: 409,
        }
      }
    }

    // 8.5 Sealed revision budget (D2): 1 initial bid + N revisions from
    //     Settings, counted after the idempotency replay so a retried
    //     final bid still replays instead of tripping the cap. Open bids
    //     are unaffected.
    if (type === 'sealed') {
      const revisionCap = resolveSealedRevisionCap(settings)
      const sealedCount = await countUserSealedBids(repos, auctionId, userId)
      if (sealedCount >= revisionCap + 1) {
        return {
          success: false,
          error: sealedRevisionCapMessage(revisionCap),
          status: 400,
          code: 'revision_cap_exceeded',
        }
      }
    }

    // 9. Writes. An under-start bid lands as pending_approval and never
    //    touches the current leader until the seller approves it.
    //    Sealed rows store no readable amount: amount_cents 0 at rest,
    //    the real amount and the snapshot inside the encrypted envelope.
    const storageAmountCents = sealedStorageAmountCents(type, eurosToCents(amount))
    const sealedPayload =
      type === 'sealed'
        ? await buildSealedIdentitySnapshot(amount, params.identitySnapshot)
        : undefined
    if (isUnderStartBid) {
      // One pending under-start bid at a time: reject the previous one.
      const oldPending = await findDoc(repos, 'bids', {
        and: [
          { auction: { equals: auctionId } },
          { status: { equals: 'pending_approval' } },
        ],
      })
      const pendingInsert = insertBidStatement(
        {
          auctionId,
          userId,
          amountCents: storageAmountCents,
          type,
          source,
          status: 'pending_approval',
          ipHash,
          idempotencyKey,
          identitySnapshot: sealedPayload,
        },
        now,
      )
      const statements: SqlStatement[] = []
      if (oldPending) {
        statements.push(
          bidStatusUpdateStatement(
            String(oldPending.id),
            'pending_approval',
            'rejected',
            now,
          ),
        )
      }
      statements.push(pendingInsert)

      const results = await db.batch<InsertedBidRow>(statements)
      const insertResult = results[statements.length - 1]
      if (!insertResult) {
        throw new Error('D1 batch returned no result for the bid insert')
      }
      const pendingBid = mapInsertedBid(
        {
          auctionId,
          userId,
          amountCents: storageAmountCents,
          type,
          source,
          status: 'pending_approval',
          ipHash,
          idempotencyKey,
          identitySnapshot: sealedPayload,
        },
        insertResult.results[0],
        pendingInsert,
      )
      events.push({
        type: 'bid.created',
        userId,
        payload: {
          auctionId,
          auctionTitle,
          amount,
          bidId: pendingBid.id,
          status: 'pending_approval',
        },
      })
      return { success: true, bid: pendingBid }
    }

    // Append the new bid and demote the previous leader in one atomic
    // D1 batch.
    const leadingInsert = insertBidStatement(
      {
        auctionId,
        userId,
        amountCents: storageAmountCents,
        type,
        source,
        status: 'leading',
        ipHash,
        idempotencyKey,
        identitySnapshot: sealedPayload,
      },
      now,
    )
    const statements: SqlStatement[] = [leadingInsert]
    if (leadingBid) {
      statements.push(
        bidStatusUpdateStatement(
          String(leadingBid.id),
          'leading',
          'outbid',
          now,
        ),
      )
    }

    const results = await db.batch<InsertedBidRow>(statements)
    const insertResult = results[0]
    if (!insertResult) {
      throw new Error('D1 batch returned no result for the bid insert')
    }
    const newBid = mapInsertedBid(
      {
        auctionId,
        userId,
        amountCents: storageAmountCents,
        type,
        source,
        status: 'leading',
        ipHash,
        idempotencyKey,
        identitySnapshot: sealedPayload,
      },
      insertResult.results[0],
      leadingInsert,
    )

    if (leadingBid) {
      const displacedUserId = leadingBid.userId as string | number
      events.push({
        type: 'outbid',
        userId: displacedUserId,
        payload: {
          auctionId,
          auctionTitle,
          currentBid: amount,
        },
      })
    }

    events.push({
      type: 'bid.created',
      userId,
      payload: {
        auctionId,
        auctionTitle,
        amount,
        bidId: newBid.id,
        status: 'leading',
      },
    })

    return { success: true, bid: newBid }
  }

  const outcome = await runBidFlow().catch((error: unknown): BidResult => {
    if (
      error instanceof Error &&
      /(duplicate key|unique constraint failed)/i.test(error.message) &&
      /idempotency_key/i.test(error.message)
    ) {
      return {
        success: false,
        error: 'Duplicate bid (idempotency key already used)',
        status: 409,
      }
    }
    throw error
  })

  // Emit only after the D1 batch succeeded, so failed bids never produce
  // notifications.
  for (const event of events) {
    eventBus.emit(event)
  }

  return outcome
}

interface InsertBidInput {
  auctionId: string
  userId: string
  /** Storage cents; sealed rows carry 0 (the amount lives in the envelope). */
  amountCents: number
  type: 'open' | 'sealed'
  source: 'manual' | 'autobidder'
  status: 'leading' | 'pending_approval'
  ipHash?: string | undefined
  idempotencyKey?: string | undefined
  identitySnapshot?: string | undefined
}

interface InsertedBidRow {
  id: string
  created_at: string
  updated_at: string
}

function insertBidStatement(input: InsertBidInput, now: string): SqlStatement {
  return {
    sql: `insert into bids (id, auction_id, user_id, amount_cents, type, source, status, identity_snapshot, ip_hash, idempotency_key, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      returning id, created_at, updated_at`,
    params: [
      crypto.randomUUID(),
      input.auctionId,
      input.userId,
      input.amountCents,
      input.type,
      input.source,
      input.status,
      input.identitySnapshot ?? null,
      input.ipHash ?? null,
      input.idempotencyKey ?? null,
      now,
      now,
    ],
  }
}

function mapInsertedBid(
  input: InsertBidInput,
  row: InsertedBidRow | undefined,
  statement: SqlStatement,
): Record<string, unknown> {
  // D1 returns the RETURNING columns; when a stub drops them, fall back to
  // the values we bound.
  const params = statement.params ?? []
  row ??= {
    id: String(params[0]),
    created_at: String(params[10]),
    updated_at: String(params[11]),
  }
  return {
    id: row.id,
    auction: input.auctionId,
    user: input.userId,
    // Mirrors the stored row: sealed bids read back as amount 0.
    amount: centsToEuros(input.amountCents),
    type: input.type,
    source: input.source,
    status: input.status,
    ...(input.ipHash !== undefined ? { ipHash: input.ipHash } : {}),
    ...(input.idempotencyKey !== undefined
      ? { idempotencyKey: input.idempotencyKey }
      : {}),
    // Sealed bids carry the ciphertext envelope; open bids never persist it.
    ...(input.identitySnapshot !== undefined
      ? { identitySnapshot: input.identitySnapshot }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
