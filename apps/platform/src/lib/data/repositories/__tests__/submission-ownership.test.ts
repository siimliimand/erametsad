import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createSqliteTestDb,
  sqliteBatchRunner,
  type SqliteTestDb,
} from '@/lib/data/__tests__/sqlite'
import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '@/lib/data/repositories'

/**
 * Portal object submission (change portal-object-submission): leads gain
 * nullable user_id and auction_id, service_requests gain nullable user_id.
 * Anonymous marketing rows keep null links; registry aliases expose
 * `user`/`auction` to where filters. A missing alias silently returns
 * empty results, so each new column needs a passing filter test.
 */

const NOW = '2026-09-15T00:00:00.000Z'

let testDb: SqliteTestDb
let repos: CoreRepositories

beforeEach(() => {
  testDb = createSqliteTestDb()
  repos = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: sqliteBatchRunner(testDb.raw),
  })
})

afterEach(() => {
  testDb.close()
})

async function createUser(id: string) {
  return repos.create({ collection: 'users', data: { id, email: `${id}@example.ee` } })
}

async function createLead(
  id: string,
  data: { userId?: string; auctionId?: string } = {},
) {
  return repos.create({
    collection: 'leads',
    data: {
      id,
      formName: 'pakkumus',
      contactName: `Contact ${id}`,
      consentAt: NOW,
      ...(data.userId !== undefined ? { user: data.userId } : {}),
      ...(data.auctionId !== undefined ? { auction: data.auctionId } : {}),
    },
  })
}

async function createServiceRequest(id: string, data: { userId?: string } = {}) {
  return repos.create({
    collection: 'service-requests',
    data: {
      id,
      type: 'kava',
      payload: { message: `payload-${id}` },
      consentAt: NOW,
      formName: 'kava-taotlus',
      ...(data.userId !== undefined ? { user: data.userId } : {}),
    },
  })
}

describe('portal submission ownership links', () => {
  it('filters leads by user equals and excludes anonymous rows', async () => {
    const user = await createUser('u1')
    const owned = await createLead('l-owned', { userId: user.id })
    await createLead('l-anon')

    expect(owned.userId).toBe(user.id)

    const result = await repos.find({
      collection: 'leads',
      where: { user: { equals: user.id } },
    })
    expect(result.docs.map((doc) => doc.id)).toEqual(['l-owned'])
  })

  it('filters leads by auction equals and excludes rows without that link', async () => {
    const auctionId = 'a-1'
    const linked = await createLead('l-auction', { auctionId })
    await createLead('l-other', { userId: 'u-2' })
    await createLead('l-anon')

    expect(linked.auctionId).toBe(auctionId)

    const result = await repos.find({
      collection: 'leads',
      where: { auction: { equals: auctionId } },
    })
    expect(result.docs.map((doc) => doc.id)).toEqual(['l-auction'])
  })

  it('filters service-requests by user equals and excludes anonymous rows', async () => {
    const user = await createUser('u1')
    const owned = await createServiceRequest('sr-owned', { userId: user.id })
    await createServiceRequest('sr-anon')

    expect(owned.userId).toBe(user.id)

    const result = await repos.find({
      collection: 'service-requests',
      where: { user: { equals: user.id } },
    })
    expect(result.docs.map((doc) => doc.id)).toEqual(['sr-owned'])
  })
})
