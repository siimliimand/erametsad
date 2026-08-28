import crypto from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { getPayloadClient } from '../../payload/payloadClient'
import { eventBus } from '../notifications/event-bus'
import type { DomainEvent } from '../notifications/event-bus'
import { isAlapakkumineEnabled } from './alapakkumine'

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
  return crypto.createHash('sha256').update(`${IP_HASH_SALT}:${ip}`).digest('hex')
}

function normalizeRequestIp(headerValue: string | undefined): string {
  const first = headerValue?.split(',')[0]?.trim()
  return first && first.length > 0 ? first : 'unknown'
}

type TxStatement = { execute: (query: unknown) => Promise<{ rows: Record<string, unknown>[] }> }

// The only place that touches Drizzle directly. All writes run inside one
// transaction started with SELECT ... FOR UPDATE on the auctions row, so
// concurrent placeBid calls serialise on that row. Reads stay on the
// Payload Local API and run while the lock is held.
export async function withAuctionLock<T>(
  payload: Payload,
  auctionId: string,
  fn: (tx: TxStatement) => Promise<T>,
): Promise<T | null> {
  const db = payload.db.drizzle
  return db.transaction(async (tx) => {
    const locked = await tx.execute(sql`select id from auctions where id = ${auctionId} for update`)
    if (!locked.rows || locked.rows.length === 0) {
      return null
    }
    return fn(tx as unknown as TxStatement)
  })
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
  const { userId, auctionId, amount, type, source, requestIp, idempotencyKey } = params

  const payload = await getPayloadClient()
  const events: DomainEvent[] = []
  const ipHash = requestIp !== undefined ? computeIpHash(normalizeRequestIp(requestIp)) : undefined

  const outcome = await withAuctionLock(
    payload,
    auctionId,
    async (tx): Promise<BidResult | null> => {
      // 1. Verify user exists
      const user = await findDoc(payload, 'users', { id: { equals: userId } })
      if (!user) {
        return { success: false, error: 'User not found', status: 401 }
      }
      if (user.status === 'suspended') {
        return { success: false, error: 'User is suspended', status: 403 }
      }

      // 2. Auction is active (read under the row lock)
      const auction = await findDoc(payload, 'auctions', { id: { equals: auctionId } })
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
      const auctionTitle = (auction.title as string | undefined) ?? `Auction ${auctionId}`

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
      const gateDisabledBySettings = featureFlags.requireFrameworkContract === false

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
          and: [
            { type: { equals: 'framework' } },
            { active: { equals: true } },
          ],
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
        if (oldPending) {
          await tx.execute(
            sql`update bids set status = 'rejected', updated_at = now() where id = ${oldPending.id as string}`,
          )
        }

        const pendingBid = await insertBid(tx, {
          auctionId,
          userId,
          amount,
          type,
          source,
          status: 'pending_approval',
          ipHash,
          idempotencyKey,
        })
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

      // Append the new bid and demote the previous leader atomically.
      const newBid = await insertBid(tx, {
        auctionId,
        userId,
        amount,
        type,
        source,
        status: 'leading',
        ipHash,
        idempotencyKey,
      })

      if (leadingBid) {
        await tx.execute(
          sql`update bids set status = 'outbid', updated_at = now() where id = ${leadingBid.id as string}`,
        )
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
    },
  ).catch((error: unknown) => {
    if (
      error instanceof Error &&
      /duplicate key/i.test(error.message) &&
      /idempotency_key/i.test(error.message)
    ) {
      return {
        success: false,
        error: 'Duplicate bid (idempotency key already used)',
        status: 409,
      } as BidResult
    }
    throw error
  })

  if (outcome === null) {
    return { success: false, error: 'Auction not found', status: 404 }
  }

  // Emit only after the transaction committed, so rolled-back bids never
  // produce notifications.
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

async function insertBid(tx: TxStatement, input: InsertBidInput): Promise<Record<string, unknown>> {
  const inserted = await tx.execute(sql`
    insert into bids (auction_id, user_id, amount, type, source, status, ip_hash, idempotency_key, created_at, updated_at)
    values (${input.auctionId}, ${input.userId}, ${input.amount}, ${input.type}, ${input.source}, ${input.status}, ${input.ipHash ?? null}, ${input.idempotencyKey ?? null}, now(), now())
    returning id, created_at, updated_at
  `)
  const row = (inserted.rows[0] ?? {}) as Record<string, unknown>
  return {
    id: row.id,
    auction: input.auctionId,
    user: input.userId,
    amount: input.amount,
    type: input.type,
    source: input.source,
    status: input.status,
    ...(input.ipHash !== undefined ? { ipHash: input.ipHash } : {}),
    ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
