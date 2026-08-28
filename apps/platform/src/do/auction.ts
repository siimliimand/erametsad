import { DurableObject, type DurableObjectState } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'

import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '../lib/data/repositories'
import * as schema from '../lib/data/schema'
import type { DbDatabase } from '../lib/db'

export interface Env {
  DB: DbDatabase
}

/**
 * Hot auction state held in DO storage. Hydrated once from D1 on the first
 * touch; `version` starts at 1 and increments on every state change so the
 * persist-back path (task 3.2+) can dirty-check against D1.
 */
export interface AuctionState {
  auctionId: string
  currentPriceCents: number
  /** ISO timestamp; null while the auction has no end time. */
  endsAt: string | null
  status: string
  /** WebSocket client URLs; managed by the subscribe flow (task 3.3). */
  subscribedClientUrls: string[]
  version: number
}

const STATE_KEY = 'auction-state'

export class AuctionDO extends DurableObject<Env> {
  private state: AuctionState | null

  constructor(ctx: DurableObjectState, env: Env) {
    // super wires the alarm dispatch that routes to alarm() below.
    super(ctx, env)
    this.state = null
  }

  async fetch(request: Request): Promise<Response> {
    // The Worker embeds the auction id it used for idFromName() in the URL:
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
      case 'bid':
      case 'subscribe':
      case 'publish':
      case 'alarm':
        // Stubs: bid lands in task 3.2, subscribe/publish in 3.3, alarm in 3.4.
        return errorResponse(501, `/${operation} is not implemented`)
      default:
        return errorResponse(404, `unknown operation /${operation}`)
    }
  }

  /** End-of-auction tick; real logic arrives in task 3.4. */
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- deliberate stub, task 3.4 implements it
  async alarm(): Promise<void> {}

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
    const state: AuctionState = {
      auctionId,
      currentPriceCents: leading.docs[0]?.amountCents ?? auction.minBidCents,
      endsAt: auction.endsAt,
      status: auction.status,
      subscribedClientUrls: [],
      version: previousVersion + 1,
    }
    await this.ctx.storage.put(STATE_KEY, state)
    this.state = state
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
