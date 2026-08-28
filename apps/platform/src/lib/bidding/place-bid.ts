import crypto from 'node:crypto'
import type { Payload } from 'payload'

import { getPayloadClient } from '../../payload/payloadClient'
import { eurosToCents } from '../data/repositories/money'
import { db, type SqlStatement } from '../db'
import { isAlapakkumineEnabled } from './alapakkumine'
import { eventBus } from '../notifications/event-bus'
import type { DomainEvent } from '../notifications/event-bus'

export interface PlaceBidParams {
  userId: string
  auctionId: string
  amount: number
  type: 'open' | 'sealed'
  source: 'manual' | 'autobidder'
  requestIp?: string
  idempotencyKey?: string
}

export interface BidSuccess {
  success: true
  bid: Record<string, unknown>
}

export interface BidError {
  success: false
  error: string
  status: number
  code?: 'framework_contract_required'
  redirectUrl?: string
}

export type BidResult = BidSuccess | BidError

const IP_HASH_SALT = process.env.PAYLOAD_SECRET ?? 'dev-ip-hash-salt'

export function computeIpHash(ip: string): string {
  return crypto
    .createHash('sha256')
    .update(`${IP_HASH_SALT}:${ip}`)
    .digest('hex')
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

type PayloadCollection =
  | 'users'
  | 'auctions'
  | 'auction-rights'
  | 'settings'
  | 'contract-templates'
  | 'contracts'
  | 'bids'

async function findDoc(
  payload: Payload,
  collection: PayloadCollection,
  where: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const result = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
  } as Parameters<Payload['find']>[0])
  return (result.docs[0] as Record<string, unknown> | undefined) ?? null
}

export async function placeBid(params: PlaceBidParams): Promise<BidResult> {
  const { userId, auctionId, amount, type, source, requestIp, idempotencyKey } =
    params

  const payload = await getPayloadClient()
  const events: DomainEvent[] = []
  const ipHash =
    requestIp !== undefined
      ? computeIpHash(normalizeRequestIp(requestIp))
      : undefined
  const now = new Date().toISOString()

  const runBidFlow = async (): Promise<BidResult> => {
    // 1. Verify user exists
    const user = await findDoc(payload, 'users', { id: { equals: userId } })
    if (!user) {
      return { success: false, error: 'User not found', status: 401 }
    }
    if (user.status === 'suspended') {
      return { success: false, error: 'User is suspended', status: 403 }
    }

    // 2. Auction is active
    const auction = await findDoc(payload, 'auctions', {
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
    const minBid = auction.minBid as number
    const auctionTitle =
      (auction.title as string | undefined) ?? `Auction ${auctionId}`

    // 3. ObjectType right
    const right = await findDoc(payload, 'auction-rights', {
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
    const settings = await findDoc(payload, 'settings', {})
    const featureFlags: Record<string, unknown> = settings?.featureFlags
      ? (settings.featureFlags as Record<string, unknown>)
      : {}
    // Gate is active by default; only an explicit false disables it (demo override).
    const gateDisabledBySettings =
      featureFlags.requireFrameworkContract === false

    // 5. Amount validity: below minBid is only legal as an alapakkumine
    //    request (pending_approval), and only when Settings enable it.
    const isUnderStartBid = amount < minBid
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
      leadingBid = await findDoc(payload, 'bids', {
        and: [
          { auction: { equals: auctionId } },
          { status: { equals: 'leading' } },
        ],
      })
      if (leadingBid) {
        const leadingAmount = leadingBid.amount as number
        const bidStep = auction.bidStep as number | undefined
        const minimumAmount = leadingAmount + (bidStep ?? 0)
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
      const template = await findDoc(payload, 'contract-templates', {
        and: [{ type: { equals: 'framework' } }, { active: { equals: true } }],
      })
      if (template) {
        const signed = await findDoc(payload, 'contracts', {
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
            redirectUrl: '/contracts/framework',
          }
        }
      }
    }

    // 8. Idempotency check
    if (idempotencyKey) {
      const existing = await findDoc(payload, 'bids', {
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

    // 9. Writes. An under-start bid lands as pending_approval and never
    //    touches the current leader until the seller approves it.
    if (isUnderStartBid) {
      // One pending under-start bid at a time: reject the previous one.
      const oldPending = await findDoc(payload, 'bids', {
        and: [
          { auction: { equals: auctionId } },
          { status: { equals: 'pending_approval' } },
        ],
      })
      const pendingInsert = insertBidStatement(
        {
          auctionId,
          userId,
          amount,
          type,
          source,
          status: 'pending_approval',
          ipHash,
          idempotencyKey,
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
          amount,
          type,
          source,
          status: 'pending_approval',
          ipHash,
          idempotencyKey,
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
        amount,
        type,
        source,
        status: 'leading',
        ipHash,
        idempotencyKey,
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
        amount,
        type,
        source,
        status: 'leading',
        ipHash,
        idempotencyKey,
      },
      insertResult.results[0],
      leadingInsert,
    )

    if (leadingBid) {
      const displacedUserId = leadingBid.user as string | number
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
  amount: number
  type: 'open' | 'sealed'
  source: 'manual' | 'autobidder'
  status: 'leading' | 'pending_approval'
  ipHash?: string | undefined
  idempotencyKey?: string | undefined
}

interface InsertedBidRow {
  id: string
  created_at: string
  updated_at: string
}

function insertBidStatement(input: InsertBidInput, now: string): SqlStatement {
  return {
    sql: `insert into bids (id, auction_id, user_id, amount_cents, type, source, status, ip_hash, idempotency_key, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      returning id, created_at, updated_at`,
    params: [
      crypto.randomUUID(),
      input.auctionId,
      input.userId,
      eurosToCents(input.amount),
      input.type,
      input.source,
      input.status,
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
    created_at: String(params[9]),
    updated_at: String(params[10]),
  }
  return {
    id: row.id,
    auction: input.auctionId,
    user: input.userId,
    amount: input.amount,
    type: input.type,
    source: input.source,
    status: input.status,
    ...(input.ipHash !== undefined ? { ipHash: input.ipHash } : {}),
    ...(input.idempotencyKey !== undefined
      ? { idempotencyKey: input.idempotencyKey }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
