import { describe, expect, it, vi } from 'vitest'

import { sweepDueAuctions, type SweepEnv, type SweepExecutionContext } from '../auction-ending'

interface WakeCall {
  auctionId: string
  method: string
}

type WakeMode = 'ok' | 'http-error' | 'throw'

function createEnv(ids: string[], modes: Record<string, WakeMode> = {}) {
  const queries: { sql: string; params: unknown[] }[] = []
  const idNames: string[] = []
  const wakes: WakeCall[] = []

  const DB = {
    prepare(sql: string) {
      const entry = { sql, params: [] as unknown[] }
      queries.push(entry)
      const statement = {
        bind: (...params: unknown[]) => {
          entry.params = params
          return statement
        },
        all: () => ({
          results: ids.map((id) => ({ id })),
          success: true,
          meta: {},
        }),
      }
      return statement
    },
  }

  const AUCTION = {
    idFromName: (name: string) => {
      idNames.push(name)
      return { name }
    },
    get: () => ({
      fetch: (url: string, init?: { method?: string }) => {
        const auctionId = new URL(url).pathname.split('/').filter(Boolean).find(Boolean) ?? ''
        wakes.push({ auctionId, method: init?.method ?? 'GET' })
        if (modes[auctionId] === 'throw') throw new Error('wake transport failed')
        if (modes[auctionId] === 'http-error') return new Response('boom', { status: 500 })
        return new Response('{"woken":true}', { status: 200 })
      },
    }),
  }

  const env = { DB, AUCTION } as unknown as SweepEnv
  const ctx = { waitUntil: vi.fn() } as unknown as SweepExecutionContext
  return { env, ctx, queries, idNames, wakes }
}

describe('sweepDueAuctions', () => {
  it('queries due active auctions capped at 50 rows', async () => {
    const { env, ctx, queries } = createEnv(['auction-1', 'auction-2'])

    await sweepDueAuctions(env, ctx)

    expect(queries).toHaveLength(1)
    expect(queries[0]?.sql).toContain('from auctions')
    expect(queries[0]?.sql).toContain('status = ?')
    expect(queries[0]?.sql).toContain('ends_at <= ?')
    expect(queries[0]?.sql).toContain('limit 50')
    expect(queries[0]?.params[0]).toBe('active')
    expect(Number.isNaN(Date.parse(String(queries[0]?.params[1])))).toBe(false)
  })

  it('wakes each due auction DO with POST /:auctionId/due', async () => {
    const { env, ctx, idNames, wakes } = createEnv(['auction-1', 'auction-2'])

    const result = await sweepDueAuctions(env, ctx)

    expect(result).toEqual({ due: 2, woken: 2, failed: 0 })
    expect(idNames).toEqual(['auction-1', 'auction-2'])
    expect(wakes).toEqual([
      { auctionId: 'auction-1', method: 'POST' },
      { auctionId: 'auction-2', method: 'POST' },
    ])
  })

  it('counts a non-ok wake response as failed and still wakes the rest', async () => {
    const { env, ctx, wakes } = createEnv(['auction-1', 'auction-2'], {
      'auction-1': 'http-error',
    })

    const result = await sweepDueAuctions(env, ctx)

    expect(result).toEqual({ due: 2, woken: 1, failed: 1 })
    expect(wakes).toHaveLength(2)
  })

  it('survives a wake fetch that throws and reports it as failed', async () => {
    const { env, ctx } = createEnv(['auction-1', 'auction-2'], { 'auction-2': 'throw' })

    const result = await sweepDueAuctions(env, ctx)

    expect(result).toEqual({ due: 2, woken: 1, failed: 1 })
  })
})
