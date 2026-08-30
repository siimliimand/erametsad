import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '../../data/__tests__/sqlite'
import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '../../data/repositories'
import { setD1ForTests } from '../../db'
import { getAuctionDossier } from '../queries'

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
  setD1ForTests(null)
  testDb.close()
})

describe('getAuctionDossier contact', () => {
  it('exposes the specialist role and photo URL', async () => {
    await repos.create({ collection: 'media', data: { id: 'm-photo', filename: 'spetsialist.jpg' } })
    await repos.create({
      collection: 'specialists',
      data: {
        id: 'sp-1',
        name: 'Mari Mets',
        slug: 'mari-mets',
        role: 'Vanemmetsaspetsialist',
        photoId: 'm-photo',
      },
    })
    await repos.create({
      collection: 'auctions',
      data: {
        id: 'a-contact',
        title: 'Auction a-contact',
        slug: 'slug-a-contact',
        objectType: 'raieoigus',
        minBidCents: 10_000,
        status: 'active',
        specialistId: 'sp-1',
        descriptionSecondary: '{"root":{"type":"root","children":[]}}',
      },
    })

    const dossier = await getAuctionDossier(repos, 'a-contact', null)
    expect(dossier?.contact.specialist).toEqual({
      id: 'sp-1',
      name: 'Mari Mets',
      phone: null,
      email: null,
      role: 'Vanemmetsaspetsialist',
      photo: '/api/v1/media/m-photo',
    })
  })

  it('returns null specialist fields without a specialist and keeps alias email', async () => {
    await repos.create({
      collection: 'auctions',
      data: {
        id: 'a-alias',
        title: 'Auction a-alias',
        slug: 'slug-a-alias',
        objectType: 'raieoigus',
        minBidCents: 10_000,
        status: 'active',
        aliasEmail: 'oksjon@example.ee',
      },
    })

    const dossier = await getAuctionDossier(repos, 'a-alias', null)
    expect(dossier?.contact).toEqual({
      aliasEmail: 'oksjon@example.ee',
      specialist: null,
    })
  })
})
