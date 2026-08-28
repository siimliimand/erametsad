import { describe, expect, it } from 'vitest'

import {
  can,
  matchesWhere,
  publicContext,
  systemContext,
  userContext,
  type GuardContext,
  type GuardDecision,
} from '../../guards'
import { GuardAccessError } from '../errors'
import { createCoreRepositories, type CoreDatabase, type RepositoryOptions } from '../repository'
import type { WhereClause } from '../where'

function whereOf(decision: GuardDecision): WhereClause {
  if (!decision.where) {
    throw new Error('expected a row filter on the decision')
  }
  return decision.where
}

const admin = userContext('admin-1', 'admin')
const superadmin = userContext('root-1', 'superadmin')
const specialist = userContext('sp-1', 'specialist')
const privateUser = userContext('u-1', 'private')

describe('can: system context', () => {
  it('allows every operation, including deny-all rules', () => {
    expect(can(systemContext, 'bids', 'delete')).toEqual({ allowed: true })
    expect(can(systemContext, 'notifications', 'create')).toEqual({ allowed: true })
    expect(can(systemContext, 'audit-entry', 'read')).toEqual({ allowed: true })
    expect(can(systemContext, 'users', 'read')).toEqual({ allowed: true })
  })
})

describe('can: auctions', () => {
  const activeRow = { id: 'a-1', status: 'active', specialistId: 'sp-9' }
  const draftRow = { id: 'a-2', status: 'draft', specialistId: 'sp-9' }
  const ownDraft = { id: 'a-3', status: 'draft', specialistId: 'sp-1', specialist: 'sp-1' }

  it('limits anonymous reads to active auctions via a row filter', () => {
    const decision = can(publicContext, 'auctions', 'read')
    expect(decision.allowed).toBe(true)
    const where = whereOf(decision)
    expect(where).toEqual({ status: { equals: 'active' } })
    expect(matchesWhere(activeRow, where)).toBe(true)
    expect(matchesWhere(draftRow, where)).toBe(false)
  })

  it('limits authenticated non-specialist reads to active auctions', () => {
    const where = whereOf(can(privateUser, 'auctions', 'read'))
    expect(where).toEqual({ status: { equals: 'active' } })
    expect(matchesWhere(ownDraft, where)).toBe(false)
  })

  it('lets specialists read their own drafts or any active auction', () => {
    const where = whereOf(can(specialist, 'auctions', 'read'))
    expect(where).toEqual({
      or: [{ specialist: { equals: 'sp-1' } }, { status: { equals: 'active' } }],
    })
    expect(matchesWhere(ownDraft, where)).toBe(true)
    expect(matchesWhere({ ...activeRow, specialistId: 'sp-other' }, where)).toBe(true)
    expect(matchesWhere({ ...draftRow, specialistId: 'sp-other' }, where)).toBe(false)
  })

  it('gives admins unfiltered reads', () => {
    const decision = can(admin, 'auctions', 'read')
    expect(decision).toEqual({ allowed: true })
  })

  it('restricts create to admin, superadmin, and specialist', () => {
    expect(can(admin, 'auctions', 'create').allowed).toBe(true)
    expect(can(superadmin, 'auctions', 'create').allowed).toBe(true)
    expect(can(specialist, 'auctions', 'create').allowed).toBe(true)
    expect(can(userContext('s-1', 'seller'), 'auctions', 'create').allowed).toBe(false)
    expect(can(privateUser, 'auctions', 'create').allowed).toBe(false)
    expect(can(publicContext, 'auctions', 'create').allowed).toBe(false)
  })

  it('limits specialist updates to auctions they own', () => {
    const own = { specialist: 'sp-1', status: 'draft' }
    const foreign = { specialist: 'sp-9', status: 'draft' }
    expect(can(specialist, 'auctions', 'update', own).allowed).toBe(true)
    expect(can(specialist, 'auctions', 'update', foreign).allowed).toBe(false)
    expect(can(admin, 'auctions', 'update', foreign).allowed).toBe(true)
    expect(can(privateUser, 'auctions', 'update', own).allowed).toBe(false)
    expect(can(publicContext, 'auctions', 'update', own).allowed).toBe(false)
  })

  it('allows deletes for admins only', () => {
    expect(can(admin, 'auctions', 'delete').allowed).toBe(true)
    expect(can(specialist, 'auctions', 'delete').allowed).toBe(false)
    expect(can(privateUser, 'auctions', 'delete').allowed).toBe(false)
  })
})

describe('can: bids', () => {
  it('requires authentication to create', () => {
    expect(can(privateUser, 'bids', 'create').allowed).toBe(true)
    expect(can(publicContext, 'bids', 'create').allowed).toBe(false)
  })

  it('limits reads to own bids or admin', () => {
    expect(can(publicContext, 'bids', 'read').allowed).toBe(false)
    const own = can(privateUser, 'bids', 'read', { user: 'u-1' })
    expect(own.allowed).toBe(true)
    expect(can(privateUser, 'bids', 'read', { user: 'u-2' }).allowed).toBe(false)
    expect(can(privateUser, 'bids', 'read').where).toEqual({ user: { equals: 'u-1' } })
    expect(can(admin, 'bids', 'read')).toEqual({ allowed: true })
  })

  it('allows updates for admins only and deletes for no one', () => {
    expect(can(admin, 'bids', 'update').allowed).toBe(true)
    expect(can(privateUser, 'bids', 'update').allowed).toBe(false)
    expect(can(admin, 'bids', 'delete').allowed).toBe(false)
    expect(can(superadmin, 'bids', 'delete').allowed).toBe(false)
  })
})

describe('can: users, profile, company-access-request', () => {
  it('restricts user reads to admins; writes follow Payload defaults', () => {
    expect(can(admin, 'users', 'read').allowed).toBe(true)
    expect(can(privateUser, 'users', 'read').allowed).toBe(false)
    expect(can(publicContext, 'users', 'read').allowed).toBe(false)
    expect(can(privateUser, 'users', 'create').allowed).toBe(true)
    expect(can(publicContext, 'users', 'create').allowed).toBe(false)
  })

  it('makes profile creation public but reads and writes own-record', () => {
    expect(can(publicContext, 'profile', 'create').allowed).toBe(true)
    expect(can(privateUser, 'profile', 'read', { user: 'u-1' }).allowed).toBe(true)
    expect(can(privateUser, 'profile', 'read', { user: 'u-2' }).allowed).toBe(false)
    expect(can(publicContext, 'profile', 'read').allowed).toBe(false)
    expect(can(privateUser, 'profile', 'update', { user: 'u-2' }).allowed).toBe(false)
    expect(can(admin, 'profile', 'delete', { user: 'u-2' }).allowed).toBe(true)
  })

  it('keeps company-access-request at the Payload authenticated default', () => {
    expect(can(privateUser, 'company-access-request', 'create').allowed).toBe(true)
    expect(can(publicContext, 'company-access-request', 'create').allowed).toBe(false)
    expect(can(publicContext, 'company-access-request', 'read').allowed).toBe(false)
  })
})

describe('can: contracts, contract-templates, settings', () => {
  it('lets any authenticated user read contracts; only admins write', () => {
    expect(can(privateUser, 'contracts', 'read').allowed).toBe(true)
    expect(can(publicContext, 'contracts', 'read').allowed).toBe(false)
    expect(can(admin, 'contracts', 'create').allowed).toBe(true)
    expect(can(privateUser, 'contracts', 'update').allowed).toBe(false)
    expect(can(privateUser, 'contracts', 'delete').allowed).toBe(false)
  })

  it('makes contract templates publicly readable and admin-writable', () => {
    expect(can(publicContext, 'contract-templates', 'read').allowed).toBe(true)
    expect(can(admin, 'contract-templates', 'create').allowed).toBe(true)
    expect(can(privateUser, 'contract-templates', 'update').allowed).toBe(false)
  })

  it('keeps settings at the Payload authenticated default', () => {
    expect(can(privateUser, 'settings', 'read').allowed).toBe(true)
    expect(can(publicContext, 'settings', 'read').allowed).toBe(false)
    expect(can(privateUser, 'settings', 'update').allowed).toBe(true)
  })
})

describe('can: own-record collections', () => {
  const ownRecordCollections = ['autobidders', 'auction-subscriptions', 'auction-rights', 'notifications']

  it('allows owners and admins, denies others and anonymous', () => {
    for (const collection of ownRecordCollections) {
      expect(can(privateUser, collection, 'read', { user: 'u-1' }).allowed, collection).toBe(true)
      expect(can(privateUser, collection, 'read', { user: 'u-2' }).allowed, collection).toBe(false)
      expect(can(admin, collection, 'read', { user: 'u-2' }).allowed, collection).toBe(true)
      expect(can(publicContext, collection, 'read').allowed, collection).toBe(false)
    }
  })

  it('allows authenticated creates on autobidders and auction-subscriptions', () => {
    expect(can(privateUser, 'autobidders', 'create').allowed).toBe(true)
    expect(can(publicContext, 'autobidders', 'create').allowed).toBe(false)
    expect(can(privateUser, 'auction-subscriptions', 'create').allowed).toBe(true)
  })

  it('restricts auction-rights writes to admins', () => {
    expect(can(admin, 'auction-rights', 'create').allowed).toBe(true)
    expect(can(privateUser, 'auction-rights', 'update').allowed).toBe(false)
    expect(can(privateUser, 'auction-rights', 'delete').allowed).toBe(false)
  })

  it('keeps notifications create/update/delete denied for everyone', () => {
    expect(can(admin, 'notifications', 'create').allowed).toBe(false)
    expect(can(superadmin, 'notifications', 'update').allowed).toBe(false)
    expect(can(admin, 'notifications', 'delete').allowed).toBe(false)
  })
})

describe('can: admin-only and public-read collections', () => {
  const adminOnlyCollections = ['leads', 'audit-entry']

  it('denies non-admins every operation on admin-only collections', () => {
    for (const collection of adminOnlyCollections) {
      for (const operation of ['read', 'create', 'update', 'delete'] as const) {
        expect(can(privateUser, collection, operation).allowed, `${collection} ${operation}`).toBe(
          false,
        )
        expect(can(publicContext, collection, operation).allowed, `${collection} ${operation}`).toBe(
          false,
        )
        expect(can(admin, collection, operation).allowed, `${collection} ${operation}`).toBe(true)
      }
    }
  })

  it('makes statistics snapshots and media publicly readable, admin-writable', () => {
    expect(can(publicContext, 'statistics-snapshots', 'read').allowed).toBe(true)
    expect(can(admin, 'statistics-snapshots', 'create').allowed).toBe(true)
    expect(can(privateUser, 'statistics-snapshots', 'update').allowed).toBe(false)
    expect(can(publicContext, 'media', 'read').allowed).toBe(true)
    expect(can(admin, 'media', 'delete').allowed).toBe(true)
  })

  it('keeps CMS content publicly readable and admin-writable', () => {
    const content = [
      'articles',
      'pages',
      'faq-categories',
      'faq-items',
      'testimonials',
      'partner-services',
      'legal-documents',
      'redirects',
      'specialists',
      'counties',
      'parishes',
    ]
    for (const collection of content) {
      expect(can(publicContext, collection, 'read').allowed, collection).toBe(true)
      expect(can(privateUser, collection, 'create').allowed, collection).toBe(false)
      expect(can(admin, collection, 'create').allowed, collection).toBe(true)
      expect(can(admin, collection, 'delete').allowed, collection).toBe(true)
    }
  })

  it('fails closed for unknown collections', () => {
    const decision = can(privateUser, 'nope', 'read')
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toContain("no read rule for 'nope'")
  })
})

describe('matchesWhere', () => {
  const row = { status: 'leading', user: 'u-1', revokedAt: null, endsAt: 100 }

  it('supports the inventoried operator set', () => {
    expect(matchesWhere(row, { status: { not_equals: 'rejected' } })).toBe(true)
    expect(matchesWhere(row, { revokedAt: { exists: false } })).toBe(true)
    expect(matchesWhere(row, { revokedAt: { exists: true } })).toBe(false)
    expect(matchesWhere(row, { user: { in: ['u-1', 'u-2'] } })).toBe(true)
    expect(matchesWhere(row, { user: { in: ['u-2'] } })).toBe(false)
    expect(matchesWhere(row, { endsAt: { less_than_equal: 150 } })).toBe(true)
    expect(matchesWhere(row, { endsAt: { less_than_equal: 50 } })).toBe(false)
  })

  it('combines with and/or', () => {
    expect(matchesWhere(row, { and: [{ status: { equals: 'leading' } }, { user: { equals: 'u-1' } }] })).toBe(true)
    expect(matchesWhere(row, { and: [{ status: { equals: 'leading' } }, { user: { equals: 'u-2' } }] })).toBe(false)
    expect(matchesWhere(row, { or: [{ user: { equals: 'u-2' } }, { status: { equals: 'leading' } }] })).toBe(true)
    expect(matchesWhere(row, { or: [{ user: { equals: 'u-2' } }, { status: { equals: 'lost' } }] })).toBe(false)
  })
})

interface DbScript {
  selectRows?: Record<string, unknown>[]
  insertRows?: Record<string, unknown>[]
  updateRows?: Record<string, unknown>[]
  deleteRows?: Record<string, unknown>[]
}

interface DbLog {
  conditions: unknown[]
  selects: number
  inserts: number
  updates: number
  deletes: number
}

function makeDb(script: DbScript, log: DbLog): CoreDatabase {
  const query = (rows: Record<string, unknown>[]) => {
    const q: Record<string, unknown> = {}
    const chain = () => q
    q.orderBy = chain
    q.limit = chain
    q.offset = chain
    q.$dynamic = chain
    q.then = (resolve: unknown, reject: unknown) =>
      Promise.resolve(rows).then(resolve as never, reject as never)
    return q
  }
  const db = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          log.selects += 1
          log.conditions.push(condition)
          return query(script.selectRows ?? [])
        },
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => {
          log.inserts += 1
          return Promise.resolve(script.insertRows ?? [])
        },
      }),
    }),
    update: () => ({
      set: () => ({
        where: (condition: unknown) => {
          log.conditions.push(condition)
          return {
            returning: () => {
              log.updates += 1
              return Promise.resolve(script.updateRows ?? [])
            },
          }
        },
      }),
    }),
    delete: () => ({
      where: (condition: unknown) => {
        log.conditions.push(condition)
        return {
          returning: () => {
            log.deletes += 1
            return Promise.resolve(script.deleteRows ?? [])
          },
        }
      },
    }),
  }
  return db as unknown as CoreDatabase
}

function sqlParams(node: unknown, out: unknown[] = []): unknown[] {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const child of node) sqlParams(child, out)
    return out
  }
  const record = node as Record<string, unknown>
  if (Array.isArray(record.queryChunks)) {
    for (const child of record.queryChunks) sqlParams(child, out)
    return out
  }
  if ('value' in record) out.push(record.value)
  return out
}

const codec = {
  encrypt: (text: string) => ({ encrypted: `enc:${text}`, iv: 'iv', authTag: 'tag' }),
  decrypt: (encrypted: string) => encrypted.replace(/^enc:/, ''),
  hash: (value: string) => `hash:${value}`,
}

function makeRepos(script: DbScript, log: DbLog, guardContext?: GuardContext) {
  const options: RepositoryOptions = { isikukoodCodec: codec }
  if (guardContext) options.guardContext = guardContext
  return createCoreRepositories(makeDb(script, log), options)
}

describe('repository guard wiring', () => {
  it('runs unguarded when no guard context is provided', async () => {
    const log: DbLog = { conditions: [], selects: 0, inserts: 0, updates: 0, deletes: 0 }
    const repos = makeRepos({ deleteRows: [{ id: 'b-1' }] }, log)
    await expect(repos.delete({ collection: 'bids', id: 'b-1' })).resolves.toBeUndefined()
    expect(log.deletes).toBe(1)
    expect(log.selects).toBe(0)
  })

  it('lets an explicit system context through unchanged', async () => {
    const log: DbLog = { conditions: [], selects: 0, inserts: 0, updates: 0, deletes: 0 }
    const repos = makeRepos(
      { selectRows: [{ id: 'b-1', userId: 'u-1' }], deleteRows: [{ id: 'b-1' }] },
      log,
      systemContext,
    )
    await expect(repos.delete({ collection: 'bids', id: 'b-1' })).resolves.toBeUndefined()
    expect(log.deletes).toBe(1)
  })

  it('applies the published-only filter to public auction finds', async () => {
    const log: DbLog = { conditions: [], selects: 0, inserts: 0, updates: 0, deletes: 0 }
    const repos = makeRepos(
      { selectRows: [{ id: 'a-1', status: 'active' }] },
      log,
      publicContext,
    )
    const result = await repos.find({ collection: 'auctions' })
    expect(result.docs).toHaveLength(1)
    expect(log.selects).toBe(1)
    expect(sqlParams(log.conditions[0])).toContain('active')
  })

  it('denies public user reads before touching the database', async () => {
    const log: DbLog = { conditions: [], selects: 0, inserts: 0, updates: 0, deletes: 0 }
    const repos = makeRepos({}, log, publicContext)
    await expect(repos.find({ collection: 'users' })).rejects.toThrow(GuardAccessError)
    expect(log.selects).toBe(0)
    expect(log.conditions).toHaveLength(0)
  })

  it('ands the own-record filter into findByID', async () => {
    const log: DbLog = { conditions: [], selects: 0, inserts: 0, updates: 0, deletes: 0 }
    const repos = makeRepos(
      { selectRows: [{ id: 'bid-1', userId: 'u-1', user: 'u-1' }] },
      log,
      privateUser,
    )
    await repos.findByID({ collection: 'bids', id: 'bid-1' })
    expect(log.selects).toBe(1)
    expect(sqlParams(log.conditions[0])).toContain('u-1')
  })

  it('pre-reads update targets and allows own-record updates', async () => {
    const log: DbLog = { conditions: [], selects: 0, inserts: 0, updates: 0, deletes: 0 }
    const autobidder = {
      id: 'ab-1',
      userId: 'u-1',
      auctionId: 'a-1',
      maxAmountCents: 10000,
      status: 'active',
    }
    const repos = makeRepos(
      { selectRows: [autobidder], updateRows: [{ ...autobidder, status: 'paused' }] },
      log,
      privateUser,
    )
    const updated = await repos.update({
      collection: 'autobidders',
      id: 'ab-1',
      data: { status: 'paused' },
    })
    expect(updated.status).toBe('paused')
    expect(log.updates).toBe(1)
  })

  it('blocks updates of another user record before the write', async () => {
    const log: DbLog = { conditions: [], selects: 0, inserts: 0, updates: 0, deletes: 0 }
    const foreign = {
      id: 'ab-2',
      userId: 'u-2',
      auctionId: 'a-1',
      maxAmountCents: 10000,
      status: 'active',
    }
    const repos = makeRepos({ selectRows: [foreign] }, log, privateUser)
    await expect(
      repos.update({ collection: 'autobidders', id: 'ab-2', data: { status: 'paused' } }),
    ).rejects.toThrow(GuardAccessError)
    expect(log.updates).toBe(0)
  })

  it('blocks non-admin deletes before the delete statement', async () => {
    const log: DbLog = { conditions: [], selects: 0, inserts: 0, updates: 0, deletes: 0 }
    const repos = makeRepos(
      { selectRows: [{ id: 'a-1', status: 'active', specialistId: 'sp-9' }] },
      log,
      privateUser,
    )
    await expect(repos.delete({ collection: 'auctions', id: 'a-1' })).rejects.toThrow(
      GuardAccessError,
    )
    expect(log.deletes).toBe(0)
  })

  it('allows specialist updates of own auctions through the row filter', async () => {
    const log: DbLog = { conditions: [], selects: 0, inserts: 0, updates: 0, deletes: 0 }
    const own = { id: 'a-1', status: 'draft', specialistId: 'sp-1' }
    const repos = makeRepos(
      { selectRows: [own], updateRows: [{ ...own, status: 'scheduled' }] },
      log,
      specialist,
    )
    await expect(
      repos.update({ collection: 'auctions', id: 'a-1', data: { status: 'scheduled' } }),
    ).resolves.toMatchObject({ id: 'a-1' })
    expect(log.updates).toBe(1)
  })

  it('denies guarded notification creates even for admins', async () => {
    const log: DbLog = { conditions: [], selects: 0, inserts: 0, updates: 0, deletes: 0 }
    const repos = makeRepos({}, log, admin)
    await expect(
      repos.create({
        collection: 'notifications',
        data: { userId: 'u-1', event: 'bid.outbid', channel: 'email', payload: {} },
      }),
    ).rejects.toThrow(GuardAccessError)
    expect(log.inserts).toBe(0)
  })

  it('throws DocumentNotFoundError when a guarded update target is missing', async () => {
    const log: DbLog = { conditions: [], selects: 0, inserts: 0, updates: 0, deletes: 0 }
    const repos = makeRepos({ selectRows: [] }, log, admin)
    await expect(
      repos.update({ collection: 'leads', id: 'l-404', data: { status: 'new' } }),
    ).rejects.toThrow('Document not found: leads#l-404')
    expect(log.updates).toBe(0)
  })
})
