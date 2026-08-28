import { DurableObject, type DurableObjectState } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'

import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '../lib/data/repositories'
import { centsToEuros, eurosToCents } from '../lib/data/repositories/money'
import * as schema from '../lib/data/schema'
import type { DbDatabase, SqlStatement } from '../lib/db'

/** Minimal producer shape of the `eametsad-jobs` Cloudflare Queue binding. */
export interface QueueProducerBinding {
  send(message: unknown): Promise<void>
}

export interface Env {
  DB: DbDatabase
  /** Optional: the DO test worker config declares no queue binding. */
  QUEUE?: QueueProducerBinding
}

/**
 * Hot auction state held in DO storage. Hydrated once from D1 on the first
 * touch; `version` starts at 1 and increments on every state change so the
 * persist-back path can dirty-check against D1.
 */
export interface AuctionState {
  auctionId: string
  currentPriceCents: number
  /** ISO timestamp; null while the auction has no end time. */
  endsAt: string | null
  status: string
  objectType: string
  /** Event hub subscriber URLs; managed by the subscribe flow (task 3.3). */
  subscribedClientUrls: string[]
  version: number
}

export type AuctionEventType =
  | 'bid:created'
  | 'auction:extended'
  | 'auction:ended'
  | 'auction:published'

export type BidSource = 'manual' | 'autobidder'

export interface BidRequest {
  auctionId: string
  userId: string
  /** EUR amount, converted to cents once at admission start. */
  amount: number
  type: 'open' | 'sealed'
  source?: BidSource
  requestIp?: string
  idempotencyKey?: string
}

export interface AutobidInfo {
  userId: string
  amount: number
  placedAt: string
}

export interface BidAdmissionResult {
  allowed: boolean
  bid?: Record<string, unknown>
  error?: string
  status?: number
  code?: 'framework_contract_required'
  redirectUrl?: string
  replayed?: boolean
  /** Leader displaced by this bid; feeds the route's outbid push. */
  previousLeading?: { userId: string; amount: number } | null
  /** Last autobid the post-bid evaluation placed, if any. */
  autobid?: AutobidInfo | null
  /** Anti-snipe extension this admission caused, if any. */
  extended?: { previousEndsAt: string; endsAt: string; windowMinutes: number } | null
}

const STATE_KEY = 'auction-state'
const IDEMPOTENCY_PREFIX = 'idempotency:'

// Local ports of anti-snipe clamping and the ip hash. The originals in
// src/lib/bidding/* import the Node repository runtime and node:crypto
// through place-bid.ts; the DO bundle must stay free of those.
const ANTI_SNIPE_DEFAULT_MINUTES = 5
const ANTI_SNIPE_MIN_MINUTES = 1
const ANTI_SNIPE_MAX_MINUTES = 30

function clampAntiSnipeMinutes(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ANTI_SNIPE_DEFAULT_MINUTES
  }
  return Math.min(
    ANTI_SNIPE_MAX_MINUTES,
    Math.max(ANTI_SNIPE_MIN_MINUTES, Math.round(value)),
  )
}

const IP_HASH_SALT = process.env.PAYLOAD_SECRET ?? 'dev-ip-hash-salt'

async function computeIpHash(ip: string): Promise<string> {
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

function relationValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value !== null && typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return ''
}

type BidFlowCollection =
  | 'users'
  | 'auctions'
  | 'auction-rights'
  | 'settings'
  | 'contract-templates'
  | 'contracts'
  | 'bids'
  | 'autobidders'

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

function deny(
  status: number,
  error: string,
  extra?: Pick<BidAdmissionResult, 'code' | 'redirectUrl'>,
): BidAdmissionResult {
  return { allowed: false, error, status, ...extra }
}

interface InsertBidInput {
  bidId: string
  auctionId: string
  userId: string
  amountCents: number
  type: 'open' | 'sealed'
  source: BidSource
  status: 'leading' | 'pending_approval'
  ipHash?: string
  idempotencyKey?: string
}

function insertBidStatement(input: InsertBidInput, now: string): SqlStatement {
  return {
    sql: `insert into bids (id, auction_id, user_id, amount_cents, type, source, status, ip_hash, idempotency_key, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      input.bidId,
      input.auctionId,
      input.userId,
      input.amountCents,
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

function bidStatusUpdateStatement(
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

function auctionTouchStatement(
  auctionId: string,
  endsAt: string,
  now: string,
): SqlStatement {
  return {
    sql: 'update auctions set ends_at = ?, updated_at = ? where id = ? and status = ?',
    params: [endsAt, now, auctionId, 'active'],
  }
}

function insertAuditStatement(
  entryId: string,
  action: string,
  entityType: 'bid' | 'auction',
  entityId: string,
  actorId: string | undefined,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  now: string,
): SqlStatement {
  return {
    sql: `insert into audit_entries (id, actor_id, action, entity_type, entity_id, before, after, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      entryId,
      actorId ?? null,
      action,
      entityType,
      entityId,
      before === null ? null : JSON.stringify(before),
      JSON.stringify(after),
      now,
      now,
    ],
  }
}

function auctionEndStatement(auctionId: string, endedAt: string, now: string): SqlStatement {
  return {
    sql: 'update auctions set status = ?, ended_at = ?, updated_at = ? where id = ? and status = ?',
    params: ['ended', endedAt, now, auctionId, 'active'],
  }
}

function auctionAppraisedStatement(
  auctionId: string,
  winningBidId: string,
  now: string,
): SqlStatement {
  return {
    sql: 'update auctions set status = ?, winning_bid = ?, updated_at = ? where id = ? and status = ?',
    params: ['appraised', winningBidId, now, auctionId, 'ended'],
  }
}

function auctionUnsoldStatement(auctionId: string, now: string): SqlStatement {
  return {
    sql: 'update auctions set status = ?, updated_at = ? where id = ? and status = ?',
    params: ['unsold', now, auctionId, 'ended'],
  }
}

interface EndNotificationInput {
  id: string
  userId: string
  event: 'auction.won' | 'auction.ended'
  title: string
  body: string
  payload: Record<string, unknown>
}

// Titles mirror src/lib/notifications/service.ts so DO-written rows and
// in-request rows render identically; the queue consumer owns delivery.
const NOTIFICATION_TITLES = {
  'auction.won': 'Te võitsite oksjoni',
  'auction.ended': 'Oksjon on lõppenud',
} as const

function endedNotification(
  id: string,
  userId: string,
  payload: Record<string, unknown> & { body: string },
): EndNotificationInput {
  const { body, ...rest } = payload
  return {
    id,
    userId,
    event: 'auction.ended',
    title: NOTIFICATION_TITLES['auction.ended'],
    body,
    payload: rest,
  }
}

function wonNotification(
  id: string,
  userId: string,
  payload: { auctionId: string; auctionTitle: string; winningBid: number },
): EndNotificationInput {
  return {
    id,
    userId,
    event: 'auction.won',
    title: NOTIFICATION_TITLES['auction.won'],
    body: `Teie pakkumus oksjonil "${payload.auctionTitle}" võitis.`,
    payload: { ...payload },
  }
}

function insertNotificationStatement(input: EndNotificationInput, now: string): SqlStatement {
  return {
    sql: `insert into notifications (id, user_id, event, channel, title, body, payload, created_at, updated_at)
      values (?, ?, ?, 'email', ?, ?, ?, ?, ?)`,
    params: [
      input.id,
      input.userId,
      input.event,
      input.title,
      input.body,
      JSON.stringify(input.payload),
      now,
      now,
    ],
  }
}

function mapBid(input: InsertBidInput, now: string): Record<string, unknown> {
  return {
    id: input.bidId,
    auction: input.auctionId,
    user: input.userId,
    amount: centsToEuros(input.amountCents),
    type: input.type,
    source: input.source,
    status: input.status,
    ...(input.ipHash !== undefined ? { ipHash: input.ipHash } : {}),
    ...(input.idempotencyKey !== undefined
      ? { idempotencyKey: input.idempotencyKey }
      : {}),
    createdAt: now,
    updatedAt: now,
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    /(duplicate key|unique constraint failed)/i.test(error.message) &&
    /idempotency_key/i.test(error.message)
  )
}

export class AuctionDO extends DurableObject<Env> {
  private state: AuctionState | null

  constructor(ctx: DurableObjectState, env: Env) {
    // super wires the alarm dispatch that routes to alarm() below.
    super(ctx, env)
    this.state = null
  }

  async fetch(request: Request): Promise<Response> {
    // The Worker embeds the auction id it used for idOfName() in the URL:
    // /:auctionId/:operation. ctx.id.name is not carried into the object
    // runtime, so the id travels with every request.
    const [auctionId, operation] = new URL(request.url).pathname.split('/').filter(Boolean)
    if (!auctionId || !operation) {
      return errorResponse(404, 'expected /:auctionId/:operation')
    }
    switch (operation) {
      case 'state': {
        if (request.method !== 'GET') {
          return errorResponse(405, `method ${request.method} not allowed on /${operation}`)
        }
        const state = await this.ensureHydrated(auctionId)
        return state ? jsonResponse(this.publicState(state)) : errorResponse(404, 'auction not found')
      }
      case 'hydrate': {
        if (request.method !== 'POST') {
          return errorResponse(405, `method ${request.method} not allowed on /${operation}`)
        }
        const state = await this.hydrateState(auctionId)
        if (!state) {
          await this.ctx.storage.delete(STATE_KEY)
          this.state = null
          return errorResponse(404, 'auction not found')
        }
        return jsonResponse(this.publicState(state))
      }
      case 'bid': {
        if (request.method !== 'POST') {
          return errorResponse(405, `method ${request.method} not allowed on /${operation}`)
        }
        return this.handleBid(auctionId, request)
      }
      case 'subscribe':
      case 'unsubscribe': {
        if (request.method !== 'POST') {
          return errorResponse(405, `method ${request.method} not allowed on /${operation}`)
        }
        return this.handleSubscription(auctionId, operation, request)
      }
      case 'publish': {
        if (request.method !== 'POST') {
          return errorResponse(405, `method ${request.method} not allowed on /${operation}`)
        }
        return this.handlePublish(auctionId)
      }
      case 'alarm':
        // Alarm scheduling is storage-driven (setAlarm), not HTTP; no
        // route handler exists by design.
        return errorResponse(501, `/${operation} is not implemented`)
      default:
        return errorResponse(404, `unknown operation /${operation}`)
    }
  }

  /**
   * End-of-auction tick. Fires at (or after) the current `endsAt`; an
   * anti-snipe extension re-arms the alarm at admission time, so an early
   * wake just reschedules. Evicted-before-hydrate objects recover the
   * auction id from the object name; the cron sweep covers the rest.
   */
  async alarm(): Promise<void> {
    const state =
      this.state ?? ((await this.ctx.storage.get<AuctionState>(STATE_KEY)) ?? null)
    if (state) {
      await this.runAlarmTick(state)
      return
    }
    const name = this.ctx.id.name
    if (!name) return
    const hydrated = await this.hydrateState(name)
    if (hydrated) await this.runAlarmTick(hydrated)
  }

  private async runAlarmTick(state: AuctionState): Promise<void> {
    if (state.status !== 'active') return
    const endsAtMs = state.endsAt !== null ? Date.parse(state.endsAt) : Number.NaN
    if (!Number.isFinite(endsAtMs)) return
    if (Date.now() < endsAtMs) {
      await this.ctx.storage.setAlarm(endsAtMs)
      return
    }
    await this.endAuction(state.auctionId)
  }

  /**
   * Two-phase ending per the status-transition guard: `active -> ended`
   * first, then the outcome (`ended -> appraised` with the winning bid, or
   * `ended -> unsold`). Sealed auctions stop at `ended` and flag the
   * pending opening ceremony instead of computing a winner. An alarm
   * retried between the phases resumes at `ended`, so the outcome is
   * never lost; every statement is status-guarded against double-fire.
   */
  private async endAuction(auctionId: string): Promise<void> {
    const now = new Date().toISOString()
    const repos = this.repositories()
    const auction = await findDoc(repos, 'auctions', { id: { equals: auctionId } })
    if (!auction) return
    if (auction.status !== 'active' && auction.status !== 'ended') return

    if (auction.status === 'active') {
      // The D1 row decides, as in admission: a non-DO writer may have
      // moved the end time after the hot state was last written.
      const endsAt = auction.endsAt as string | undefined
      if (endsAt !== undefined && Date.now() < Date.parse(endsAt)) {
        await this.ctx.storage.setAlarm(Date.parse(endsAt))
        await this.updateHotState({ endsAt })
        return
      }

      const auctionTitle = auction.title as string
      const isSealed = auction.type === 'sealed'
      const sellerId = relationValue(auction.sellerId)
      const basePayload = { auctionId, auctionTitle, type: auction.type }
      const sealedNotifications: EndNotificationInput[] = []
      if (isSealed && sellerId) {
        sealedNotifications.push(
          endedNotification(crypto.randomUUID(), sellerId, {
            ...basePayload,
            sealedOpeningPending: true,
            body: `Oksjon "${auctionTitle}" on lõppenud. Lukustatud pakkumised ootavad avamist.`,
          }),
        )
      }
      await this.runBatch([
        auctionEndStatement(auctionId, now, now),
        insertAuditStatement(
          crypto.randomUUID(),
          'auction_ended',
          'auction',
          auctionId,
          undefined,
          { status: 'active', endsAt: endsAt ?? null },
          {
            status: 'ended',
            endedAt: now,
            ...(isSealed ? { sealedOpeningPending: true } : {}),
          },
          now,
        ),
        ...sealedNotifications.map((n) => insertNotificationStatement(n, now)),
      ])
      await this.updateHotState({ status: 'ended' })
      await this.enqueueNotificationFanout(sealedNotifications.map((n) => n.id))
      if (isSealed) {
        await this.broadcast('auction:ended', {
          auctionId,
          type: 'sealed',
          sealedOpeningPending: true,
        })
        return
      }
    }

    // Outcome phase: open auctions only; sealed stays at `ended` until
    // the opening ceremony (task 6.x admin endpoint).
    if (auction.type === 'sealed') return

    const auctionTitle = auction.title as string
    const sellerId = relationValue(auction.sellerId)
    const basePayload = { auctionId, auctionTitle, type: 'open' as const }
    const leadingBid = await this.findLeadingBid(repos, auctionId)
    const reserveCents = auction.reservePriceCents as number | null | undefined
    const reserveMet =
      leadingBid !== null &&
      (reserveCents == null || (leadingBid.amountCents as number) >= reserveCents)

    if (leadingBid && reserveMet) {
      const winningBidId = String(leadingBid.id)
      const finalPrice = centsToEuros(leadingBid.amountCents as number)
      const winnerId = relationValue(leadingBid.userId)
      const notifications: EndNotificationInput[] = []
      if (winnerId) {
        notifications.push(
          wonNotification(crypto.randomUUID(), winnerId, {
            auctionId,
            auctionTitle,
            winningBid: finalPrice,
          }),
        )
      }
      if (sellerId) {
        notifications.push(
          endedNotification(crypto.randomUUID(), sellerId, {
            ...basePayload,
            hasWinner: true,
            finalPrice,
            body: `Oksjon "${auctionTitle}" on lõppenud. Lõpphind ${String(finalPrice)} EUR.`,
          }),
        )
      }
      await this.runBatch([
        auctionAppraisedStatement(auctionId, winningBidId, now),
        insertAuditStatement(
          crypto.randomUUID(),
          'auction_outcome_computed',
          'auction',
          auctionId,
          undefined,
          { status: 'ended' },
          { status: 'appraised', winningBidId },
          now,
        ),
        ...notifications.map((n) => insertNotificationStatement(n, now)),
      ])
      await this.updateHotState({ status: 'appraised' })
      await this.enqueueNotificationFanout(notifications.map((n) => n.id))
      await this.broadcast('auction:ended', {
        auctionId,
        type: 'open',
        hasWinner: true,
        winningBidId,
      })
      return
    }

    const bidderId = leadingBid === null ? null : relationValue(leadingBid.userId)
    const notifications: EndNotificationInput[] = []
    if (bidderId && leadingBid) {
      notifications.push(
        endedNotification(crypto.randomUUID(), bidderId, {
          ...basePayload,
          hasWinner: false,
          reserveNotMet: true,
          amount: centsToEuros(leadingBid.amountCents as number),
          body: `Oksjon "${auctionTitle}" on lõppenud. Reservhind jäi täitmata.`,
        }),
      )
    }
    if (sellerId) {
      notifications.push(
        endedNotification(crypto.randomUUID(), sellerId, {
          ...basePayload,
          hasWinner: false,
          reserveNotMet: leadingBid !== null,
          body:
            leadingBid !== null
              ? `Oksjon "${auctionTitle}" lõppes reservhinda täitmata.`
              : `Oksjon "${auctionTitle}" lõppes müümata.`,
        }),
      )
    }
    await this.runBatch([
      auctionUnsoldStatement(auctionId, now),
      insertAuditStatement(
        crypto.randomUUID(),
        'auction_outcome_computed',
        'auction',
        auctionId,
        undefined,
        { status: 'ended' },
        { status: 'unsold', reserveMet: false },
        now,
      ),
      ...notifications.map((n) => insertNotificationStatement(n, now)),
    ])
    await this.updateHotState({ status: 'unsold' })
    await this.enqueueNotificationFanout(notifications.map((n) => n.id))
    await this.broadcast('auction:ended', {
      auctionId,
      type: 'open',
      hasWinner: false,
      reserveNotMet: leadingBid !== null,
    })
  }

  private async enqueueNotificationFanout(notificationIds: string[]): Promise<void> {
    const queue = this.env.QUEUE
    if (!queue || notificationIds.length === 0) return
    // The notification rows are durable; a failed enqueue must not break
    // the already-committed transition, so failures only log here.
    try {
      for (const notificationId of notificationIds) {
        await queue.send({ type: 'notification-fanout', notificationId })
      }
    } catch (error) {
      console.error('[auction-do] notification fanout enqueue failed', error)
    }
  }

  private async handleBid(auctionId: string, request: Request): Promise<Response> {
    let body: Partial<BidRequest>
    try {
      body = (await request.json()) as Partial<BidRequest>
    } catch {
      return errorResponse(400, 'expected a JSON body')
    }
    const { userId, amount, type } = body
    if (typeof userId !== 'string' || userId.length === 0) {
      return errorResponse(400, 'userId is required')
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      return errorResponse(400, 'amount must be a non-negative number')
    }
    if (type !== 'open' && type !== 'sealed') {
      return errorResponse(400, 'type must be open or sealed')
    }
    if (
      body.source !== undefined &&
      !(['manual', 'autobidder'] as string[]).includes(body.source)
    ) {
      return errorResponse(400, 'source must be manual or autobidder')
    }
    const result = await this.admitBid({
      auctionId,
      userId,
      amount,
      type,
      source: body.source ?? 'manual',
      ...(body.requestIp !== undefined ? { requestIp: body.requestIp } : {}),
      ...(body.idempotencyKey !== undefined
        ? { idempotencyKey: body.idempotencyKey }
        : {}),
    })
    return jsonResponse(result)
  }

  /**
   * The single bid admission path. The DO's serialized execution replaces
   * the deleted Postgres row lock: every bid for this auction enters here
   * one at a time, reads fresh leader/config state from D1, and writes the
   * accepted bid plus its follow-ups through atomic batch() calls.
   */
  private async admitBid(input: BidRequest): Promise<BidAdmissionResult> {
    const { userId, amount, type, requestIp, idempotencyKey } = input
    const source = input.source ?? 'manual'
    const amountCents = eurosToCents(amount)
    const now = new Date().toISOString()
    const nowMs = Date.now()

    if (!(await this.ensureHydrated(input.auctionId))) {
      return deny(404, 'Auction not found')
    }

    // Replay beats validation: a retried request must get the original
    // answer without re-running the chain or writing again.
    if (idempotencyKey) {
      const stored = await this.ctx.storage.get<BidAdmissionResult>(
        `${IDEMPOTENCY_PREFIX}${idempotencyKey}`,
      )
      if (stored?.allowed) {
        return { ...stored, replayed: true }
      }
    }

    const repos = this.repositories()
    const events: { type: AuctionEventType; data: unknown }[] = []

    // 1. Verify user exists
    const user = await findDoc(repos, 'users', { id: { equals: userId } })
    if (!user) {
      return deny(401, 'User not found')
    }
    if (user.status === 'suspended') {
      return deny(403, 'User is suspended')
    }

    // 2. Auction is active. The D1 row, not the hot cache, decides: other
    // writers (ending worker, seller approvals) can move it between calls.
    const auction = await findDoc(repos, 'auctions', {
      id: { equals: input.auctionId },
    })
    if (!auction) {
      return deny(404, 'Auction not found')
    }
    if (auction.status !== 'active') {
      return deny(400, 'Auction is not active')
    }
    const endsAt = auction.endsAt as string | undefined
    if (!endsAt || new Date(endsAt).getTime() <= nowMs) {
      return deny(400, 'Auction has ended')
    }

    const objectType = auction.objectType as string
    const minBidCents = auction.minBidCents as number

    // 3. ObjectType right
    const right = await findDoc(repos, 'auction-rights', {
      and: [
        { user: { equals: userId } },
        { objectType: { equals: objectType } },
        { revokedAt: { exists: false } },
      ],
    })
    if (!right) {
      return deny(403, 'No bidding right for this object type')
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
    const isUnderStartBid = amountCents < minBidCents
    if (isUnderStartBid && settings?.alapakkumineEnabled !== true) {
      return deny(400, `Bid must be at least ${String(centsToEuros(minBidCents))} EUR`)
    }

    // 6. Step validation against the current leader (normal path only)
    let leadingBid: Record<string, unknown> | null = null
    if (!isUnderStartBid) {
      leadingBid = await this.findLeadingBid(repos, input.auctionId)
      if (leadingBid) {
        const auctionBidStepCents = auction.bidStepCents as number | null
        const minimumCents =
          (leadingBid.amountCents as number) + (auctionBidStepCents ?? 0)
        if (amountCents < minimumCents) {
          return deny(
            400,
            `Bid must be at least ${String(centsToEuros(minimumCents))} EUR`,
          )
        }
      }
    }

    // 7. Framework contract gate (open bids only; sealed bids skip it)
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
          return deny(403, 'Framework contract required', {
            code: 'framework_contract_required',
            redirectUrl: '/contracts/framework',
          })
        }
      }
    }

    // 8. Cross-writer idempotency: keys written outside this DO (the
    //    place-bid.ts path) still replay instead of failing.
    if (idempotencyKey) {
      const existing = await findDoc(repos, 'bids', {
        idempotencyKey: { equals: idempotencyKey },
      })
      if (existing) {
        return {
          allowed: true,
          bid: this.mapBidDoc(existing),
          replayed: true,
          previousLeading: null,
          autobid: null,
          extended: null,
        }
      }
    }

    const ipHash =
      requestIp !== undefined
        ? await computeIpHash(normalizeRequestIp(requestIp))
        : undefined
    const insertInput: InsertBidInput = {
      bidId: crypto.randomUUID(),
      auctionId: input.auctionId,
      userId,
      amountCents,
      type,
      source,
      status: isUnderStartBid ? 'pending_approval' : 'leading',
      ...(ipHash !== undefined ? { ipHash } : {}),
      ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    }

    // 9. Writes. An under-start bid lands as pending_approval and never
    //    touches the current leader until the seller approves it.
    if (isUnderStartBid) {
      // One pending under-start bid at a time: reject the previous one.
      const oldPending = await findDoc(repos, 'bids', {
        and: [
          { auction: { equals: input.auctionId } },
          { status: { equals: 'pending_approval' } },
        ],
      })
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
      statements.push(
        insertBidStatement(insertInput, now),
        insertAuditStatement(
          crypto.randomUUID(),
          'bid_placed',
          'bid',
          insertInput.bidId,
          userId,
          null,
          {
            auctionId: input.auctionId,
            amountCents,
            status: 'pending_approval',
            source,
          },
          now,
        ),
      )
      try {
        await this.runBatch(statements)
      } catch (error) {
        if (isUniqueViolation(error)) {
          return deny(409, 'Duplicate bid (idempotency key already used)')
        }
        throw error
      }
      const result: BidAdmissionResult = {
        allowed: true,
        bid: mapBid(insertInput, now),
        previousLeading: null,
        autobid: null,
        extended: null,
      }
      await this.storeIdempotencyResult(idempotencyKey, result)
      return result
    }

    // Anti-snipe extension (sealed auctions never extend). The port keeps
    // checkAntiSnipe semantics: only a bid inside the window extends, and
    // the extension is one window past the previous end.
    let extended:
      | { previousEndsAt: string; endsAt: string; windowMinutes: number }
      | null = null
    if (auction.type !== 'sealed') {
      const windowMinutes = clampAntiSnipeMinutes(
        settings?.antiSnipeDurationMinutes as number | undefined,
      )
      const windowMs = windowMinutes * 60 * 1000
      const endsAtMs = new Date(endsAt).getTime()
      if (nowMs >= endsAtMs - windowMs) {
        extended = {
          previousEndsAt: endsAt,
          endsAt: new Date(endsAtMs + windowMs).toISOString(),
          windowMinutes,
        }
      }
    }

    const statements: SqlStatement[] = [
      insertBidStatement(insertInput, now),
      auctionTouchStatement(
        input.auctionId,
        extended?.endsAt ?? endsAt,
        now,
      ),
      insertAuditStatement(
        crypto.randomUUID(),
        'bid_placed',
        'bid',
        insertInput.bidId,
        userId,
        leadingBid
          ? {
              leadingBidId: String(leadingBid.id),
              leadingAmountCents: leadingBid.amountCents as number,
            }
          : null,
        {
          auctionId: input.auctionId,
          amountCents,
          status: 'leading',
          source,
          ...(extended !== null ? { extended } : {}),
        },
        now,
      ),
    ]
    if (leadingBid) {
      statements.push(
        bidStatusUpdateStatement(String(leadingBid.id), 'leading', 'outbid', now),
      )
    }

    try {
      await this.runBatch(statements)
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Lost a race against a non-DO writer using the same key; replay
        // the durable row instead of surfacing the constraint error.
        const existing = await findDoc(repos, 'bids', {
          idempotencyKey: { equals: idempotencyKey },
        })
        if (existing) {
          return {
            allowed: true,
            bid: this.mapBidDoc(existing),
            replayed: true,
            previousLeading: null,
            autobid: null,
            extended: null,
          }
        }
        return deny(409, 'Duplicate bid (idempotency key already used)')
      }
      throw error
    }

    // Hot state catches up to the write that just committed.
    await this.updateHotState(
      extended !== null
        ? { currentPriceCents: amountCents, endsAt: extended.endsAt }
        : { currentPriceCents: amountCents },
    )
    if (extended) {
      // The alarm must track the extension or the auction would end at
      // the pre-anti-snipe time.
      await this.ctx.storage.setAlarm(Date.parse(extended.endsAt))
    }

    events.push({
      type: 'bid:created',
      data: {
        auctionId: input.auctionId,
        amount: centsToEuros(amountCents),
        placedAt: now,
      },
    })
    if (extended) {
      events.push({
        type: 'auction:extended',
        data: {
          auctionId: input.auctionId,
          previousEndsAt: extended.previousEndsAt,
          endsAt: extended.endsAt,
        },
      })
    }

    // Emit only after every write succeeded, so failed bids never
    // produce events.
    for (const event of events) {
      await this.broadcast(event.type, event.data)
    }

    // Autobidders react only to bids that took the lead, and the loop is
    // manual-source only so an autobid never re-triggers evaluation. An
    // admitted autobid broadcasts its own events from its admitBid call.
    let autobid: AutobidInfo | null = null
    if (source === 'manual') {
      autobid = await this.evaluateAutobidders(repos, auction, now)
    }

    const result: BidAdmissionResult = {
      allowed: true,
      bid: mapBid(insertInput, now),
      previousLeading: leadingBid
        ? {
            userId: relationValue(leadingBid.userId),
            amount: centsToEuros(leadingBid.amountCents as number),
          }
        : null,
      autobid,
      extended,
    }
    await this.storeIdempotencyResult(idempotencyKey, result)
    return result
  }

  private findLeadingBid(
    repos: CoreRepositories,
    auctionId: string,
  ): Promise<Record<string, unknown> | null> {
    return findDoc(repos, 'bids', {
      and: [
        { auction: { equals: auctionId } },
        { status: { equals: 'leading' } },
      ],
    })
  }

  /**
   * Sequential autobidder pass after an accepted leading bid. Each round
   * admits at most the one strongest eligible autobidder (same winner
   * rule as src/lib/bidding/autobidder.ts); an admitted autobid re-enters
   * admitBid, which broadcasts its own events and may extend the auction.
   */
  private async evaluateAutobidders(
    repos: CoreRepositories,
    auction: Record<string, unknown>,
    now: string,
  ): Promise<AutobidInfo | null> {
    const auctionId = auction.id as string
    const bidStepCents = auction.bidStepCents as number | null
    const minBidCents = auction.minBidCents as number

    const autobiddersResult = await repos.find({
      collection: 'autobidders',
      where: {
        and: [
          { auction: { equals: auctionId } },
          { status: { equals: 'active' } },
        ],
      },
      sort: 'createdAt',
    })
    const autobidders = autobiddersResult.docs as Record<string, unknown>[]
    if (autobidders.length === 0) return null

    let last: AutobidInfo | null = null
    // Every admitted autobid demotes the previous leader, so at most one
    // autobid per autobidder can ever be placed; the cap is a belt against
    // a data anomaly looping forever.
    for (let round = 0; round <= autobidders.length; round++) {
      const leading = await this.findLeadingBid(repos, auctionId)
      const leadingUser =
        leading === null ? undefined : relationValue(leading.userId)
      const leadingAmountCents =
        leading === null ? undefined : (leading.amountCents as number)

      // No self-overbid: the autobidder whose user already leads never raises.
      const candidates = autobidders.filter(
        (a) => relationValue(a.userId) !== leadingUser,
      )
      if (candidates.length === 0) return last

      const winner = candidates.reduce((best, candidate) => {
        const candidateMax = candidate.maxAmountCents as number
        const bestMax = best.maxAmountCents as number
        if (
          candidateMax > bestMax ||
          (candidateMax === bestMax &&
            new Date(candidate.createdAt as string).getTime() <
              new Date(best.createdAt as string).getTime())
        ) {
          return candidate
        }
        return best
      })

      let rivalMaxCents: number | null = null
      for (const autobidder of autobidders) {
        if (autobidder === winner) continue
        const max = autobidder.maxAmountCents as number
        if (rivalMaxCents === null || max > rivalMaxCents) rivalMaxCents = max
      }

      const requiredCents =
        leadingAmountCents !== undefined
          ? leadingAmountCents + (bidStepCents ?? 0)
          : minBidCents
      const winnerMaxCents = winner.maxAmountCents as number
      if (winnerMaxCents < requiredCents) return last

      // Single pass: clear the minimum and the strongest rival max in one bid.
      let targetCents = requiredCents
      if (rivalMaxCents !== null) {
        targetCents = Math.max(targetCents, rivalMaxCents + (bidStepCents ?? 0))
      }
      targetCents = Math.min(targetCents, winnerMaxCents)

      const result = await this.admitBid({
        userId: relationValue(winner.userId),
        auctionId,
        amount: centsToEuros(targetCents),
        type: 'open',
        source: 'autobidder',
      })
      if (!result.allowed) return last
      const placedAt =
        (result.bid?.createdAt as string | undefined) ?? now
      last = {
        userId: relationValue(winner.userId),
        amount: centsToEuros(targetCents),
        placedAt,
      }
    }
    return last
  }

  private async handleSubscription(
    auctionId: string,
    operation: 'subscribe' | 'unsubscribe',
    request: Request,
  ): Promise<Response> {
    const state = await this.ensureHydrated(auctionId)
    if (!state) {
      return errorResponse(404, 'auction not found')
    }
    let body: { url?: unknown }
    try {
      body = (await request.json()) as { url?: unknown }
    } catch {
      return errorResponse(400, 'expected a JSON body')
    }
    const url = body.url
    if (typeof url !== 'string' || !isValidSubscriberUrl(url)) {
      return errorResponse(400, 'url must be a valid http(s) URL')
    }
    const current = state.subscribedClientUrls
    if (operation === 'subscribe') {
      if (current.includes(url)) {
        return jsonResponse({ url, subscriberCount: current.length, added: false })
      }
      current.push(url)
    } else {
      const index = current.indexOf(url)
      if (index === -1) {
        return jsonResponse({ url, subscriberCount: current.length, removed: false })
      }
      current.splice(index, 1)
    }
    await this.updateHotState({})
    return jsonResponse({
      url,
      subscriberCount: state.subscribedClientUrls.length,
      added: operation === 'subscribe',
    })
  }

  private async handlePublish(auctionId: string): Promise<Response> {
    const state = await this.hydrateState(auctionId)
    if (!state) {
      return errorResponse(404, 'auction not found')
    }
    await this.broadcast('auction:published', {
      auctionId,
      endsAt: state.endsAt ?? undefined,
      objectType: state.objectType,
    })
    return jsonResponse(this.publicState(state))
  }

  /**
   * Fan-out to this auction's subscriber URLs. One DO per auction means
   * the registry is complete by construction: no cross-isolate miss.
   * Delivery failures drop the subscriber, mirroring the in-memory
   * stream's dead-client cleanup.
   */
  private async broadcast(type: AuctionEventType, data: unknown): Promise<void> {
    const state = this.state
    if (!state || state.subscribedClientUrls.length === 0) return
    const payload = JSON.stringify({ type, auctionId: state.auctionId, data })
    const dead: string[] = []
    await Promise.allSettled(
      state.subscribedClientUrls.map(async (url) => {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: payload,
          })
          if (response.status >= 400) dead.push(url)
        } catch {
          dead.push(url)
        }
      }),
    )
    if (dead.length > 0 && this.state) {
      this.state.subscribedClientUrls = this.state.subscribedClientUrls.filter(
        (url) => !dead.includes(url),
      )
      await this.updateHotState({})
    }
  }

  private async storeIdempotencyResult(
    idempotencyKey: string | undefined,
    result: BidAdmissionResult,
  ): Promise<void> {
    if (!idempotencyKey) return
    await this.ctx.storage.put(`${IDEMPOTENCY_PREFIX}${idempotencyKey}`, result)
  }

  /** Persists the hot state after a mutation, bumping the version. */
  private async updateHotState(changes: {
    currentPriceCents?: number
    endsAt?: string | null
    status?: string
  }): Promise<void> {
    const base = this.state
    if (!base) return
    const next: AuctionState = {
      ...base,
      ...(changes.currentPriceCents !== undefined
        ? { currentPriceCents: changes.currentPriceCents }
        : {}),
      ...(changes.endsAt !== undefined && changes.endsAt !== null
        ? { endsAt: changes.endsAt }
        : {}),
      ...(changes.status !== undefined ? { status: changes.status } : {}),
      version: base.version + 1,
    }
    await this.ctx.storage.put(STATE_KEY, next)
    this.state = next
  }

  private mapBidDoc(doc: Record<string, unknown>): Record<string, unknown> {
    return {
      id: doc.id,
      auction: relationValue(doc.auctionId ?? doc.auction),
      user: relationValue(doc.userId ?? doc.user),
      amount: centsToEuros(doc.amountCents as number),
      type: doc.type,
      source: doc.source,
      status: doc.status,
      ...(doc.ipHash !== undefined ? { ipHash: doc.ipHash } : {}),
      ...(doc.idempotencyKey !== undefined
        ? { idempotencyKey: doc.idempotencyKey }
        : {}),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
  }

  private async runBatch(statements: readonly SqlStatement[]): Promise<void> {
    if (statements.length === 0) return
    await this.env.DB.batch(
      statements.map((statement) =>
        statement.params && statement.params.length > 0
          ? this.env.DB.prepare(statement.sql).bind(...statement.params)
          : this.env.DB.prepare(statement.sql),
      ),
    )
  }

  private publicState(state: AuctionState) {
    return {
      auctionId: state.auctionId,
      status: state.status,
      currentPriceCents: state.currentPriceCents,
      endsAt: state.endsAt,
      subscriberCount: state.subscribedClientUrls.length,
      version: state.version,
    }
  }

  /** Serves from storage once hydrated (version >= 1); first touch loads D1. */
  private async ensureHydrated(auctionId: string): Promise<AuctionState | null> {
    if (this.state) return this.state
    const stored = await this.ctx.storage.get<AuctionState>(STATE_KEY)
    if (stored && stored.version >= 1) {
      this.state = stored
      return stored
    }
    return this.hydrateState(auctionId)
  }

  private async hydrateState(auctionId: string): Promise<AuctionState | null> {
    if (!auctionId) return null
    const repos = this.repositories()
    const auction = await repos.findByID({ collection: 'auctions', id: auctionId })
    if (!auction) return null
    const leading = await repos.find({
      collection: 'bids',
      where: { auction: { equals: auctionId }, status: { equals: 'leading' } },
      sort: '-createdAt',
      limit: 1,
    })
    const stored = this.state ? undefined : await this.ctx.storage.get<AuctionState>(STATE_KEY)
    const previousVersion = this.state?.version ?? stored?.version ?? 0
    // A forced hydrate keeps the subscriber set: rehydrating must not
    // silently drop live event listeners.
    const previousSubscribers =
      this.state?.subscribedClientUrls ?? stored?.subscribedClientUrls ?? []
    const state: AuctionState = {
      auctionId,
      currentPriceCents:
        (leading.docs[0] as { amountCents?: number } | undefined)?.amountCents ??
        auction.minBidCents,
      endsAt: auction.endsAt,
      status: auction.status,
      objectType: auction.objectType,
      subscribedClientUrls: previousSubscribers,
      version: previousVersion + 1,
    }
    await this.ctx.storage.put(STATE_KEY, state)
    this.state = state
    if (state.status === 'active' && state.endsAt !== null) {
      const endsAtMs = Date.parse(state.endsAt)
      const current = await this.ctx.storage.getAlarm()
      if (Number.isFinite(endsAtMs) && (current === null || current < endsAtMs)) {
        // First touch owns the end time; a later anti-snipe extension
        // re-arms at admission.
        await this.ctx.storage.setAlarm(endsAtMs)
      }
    }
    return state
  }

  /**
   * Trusted system-context repositories over the DO's own D1 binding; the
   * guard context is omitted because the DO is a system process, matching
   * getRepositories() without a guard in src/lib/data/runtime.ts.
   */
  private repositories(): CoreRepositories {
    const database = drizzle(this.env.DB as unknown as Parameters<typeof drizzle>[0], { schema })
    return createCoreRepositories(database, {
      isikukoodCodec: nodeIsikukoodCodec,
      batch: (statements) => database.batch(statements),
    })
  }
}

function isValidSubscriberUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' },
  })
}
