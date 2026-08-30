import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '../../data/__tests__/sqlite'
import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '../../data/repositories'
import { setD1ForTests } from '../../db'
import {
  ARCHIVE_SORT_OPTIONS,
  AuctionQueryError,
  DEFAULT_AUCTION_LIST_LIMIT,
  archivedStatsByObjectType,
  getAuctionBids,
  getAuctionDossier,
  listAuctionMapPoints,
  listAuctions,
  listArchivedAuctions,
  parseAuctionSearchParams,
  type AuctionViewer,
} from '../queries'

type AuctionOverrides = Partial<Record<string, unknown>>

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

async function seedCounty(id: string, name: string, code: string): Promise<void> {
  await repos.create({ collection: 'counties', data: { id, name, code } })
}

async function seedParish(id: string, name: string, countyId: string): Promise<void> {
  await repos.create({ collection: 'parishes', data: { id, name, countyId } })
}

async function seedUser(id: string): Promise<void> {
  await repos.create({ collection: 'users', data: { id, email: `${id}@example.com` } })
}

async function seedAuction(id: string, overrides: AuctionOverrides = {}): Promise<void> {
  await repos.create({
    collection: 'auctions',
    data: {
      id,
      title: `Auction ${id}`,
      slug: `slug-${id}`,
      objectType: 'raieoigus',
      minBidCents: 10_000,
      ...overrides,
    },
  })
}

interface SeedBidData {
  auctionId: string
  userId: string
  amountCents: number
  status?: string
  source?: string
  type?: string
  /** Pins created_at: hook stamps are wall-clock, so label order needs this. */
  createdAt?: string
}

async function seedBid(id: string, data: SeedBidData): Promise<void> {
  await repos.create({
    collection: 'bids',
    data: {
      id,
      auction: data.auctionId,
      user: data.userId,
      amountCents: data.amountCents,
      type: data.type ?? 'open',
      source: data.source ?? 'manual',
      status: data.status ?? 'leading',
    },
  })
  if (data.createdAt !== undefined) {
    testDb.raw
      .prepare('UPDATE bids SET created_at = ?, updated_at = ? WHERE id = ?')
      .run(data.createdAt, data.createdAt, id)
  }
}

const viewer = (userId: string): AuctionViewer => ({ userId })

type BidView = NonNullable<Awaited<ReturnType<typeof getAuctionBids>>>
type AuthedBidView = Extract<BidView, { kind: 'authed' }>

/** Narrows an authed view so the property assertions below typecheck. */
function expectAuthed(view: BidView | null): asserts view is AuthedBidView {
  expect(view !== null).toBe(true)
  expect(view?.kind).toBe('authed')
}

describe('parseAuctionSearchParams', () => {
  it('defaults to endTime ascending with the standard page size', () => {
    const filters = parseAuctionSearchParams(new URLSearchParams(''))
    expect(filters.sortField).toBe('endTime')
    expect(filters.sortDirection).toBe('asc')
    expect(filters.page).toBe(1)
    expect(filters.limit).toBe(DEFAULT_AUCTION_LIST_LIMIT)
    expect(filters.map).toBe(false)
    expect(filters.statuses).toEqual([])
  })

  it('reads explicit sort keys and the order parameter', () => {
    const filters = parseAuctionSearchParams(new URLSearchParams('sort=startPrice&order=desc'))
    expect(filters.sortField).toBe('startPrice')
    expect(filters.sortDirection).toBe('desc')

    const shorthand = parseAuctionSearchParams(new URLSearchParams('sort=-endPrice'))
    expect(shorthand.sortField).toBe('endPrice')
    expect(shorthand.sortDirection).toBe('desc')
  })

  it('rejects an unknown sort field', () => {
    expect(() =>
      parseAuctionSearchParams(new URLSearchParams('sort=reservePrice')),
    ).toThrow(AuctionQueryError)
  })

  it('clamps page and limit into the allowed range', () => {
    const filters = parseAuctionSearchParams(new URLSearchParams('page=0&limit=9999'))
    expect(filters.page).toBe(1)
    expect(filters.limit).toBe(100)
    expect(parseAuctionSearchParams(new URLSearchParams('limit=-5')).limit).toBe(1)
  })
})

describe('listAuctions filters', () => {
  beforeEach(async () => {
    await seedCounty('c1', 'Harjumaa', 'HH')
    await seedCounty('c2', 'Tartumaa', 'TA')
    await seedParish('p1', 'Keila', 'c1')
    await seedUser('seller-1')
    // Matches both filters: Harjumaa + mänd.
    await seedAuction('a-harju-man', {
      status: 'active',
      countyId: 'c1',
      species: ['mänd'],
      endsAt: '2026-09-10T00:00:00.000Z',
    })
    // Right county, wrong species.
    await seedAuction('a-harju-kuu', {
      status: 'active',
      countyId: 'c1',
      species: ['kuusk'],
      endsAt: '2026-09-01T00:00:00.000Z',
    })
    // Right species, wrong county.
    await seedAuction('a-tartu-man', {
      status: 'active',
      countyId: 'c2',
      species: ['mänd'],
      endsAt: '2026-09-05T00:00:00.000Z',
    })
  })

  it('combines county and species filters', async () => {
    const result = await listAuctions(repos, new URLSearchParams('county=HH&species=ma'))
    expect(result.total).toBe(1)
    expect(result.auctions.map((a) => a.id)).toEqual(['a-harju-man'])
  })

  it('accepts the Estonian species name as the token', async () => {
    const result = await listAuctions(repos, new URLSearchParams('species=m%C3%A4nd'))
    expect(result.total).toBe(2)
  })
})

describe('listAuctions sorting and pagination', () => {
  beforeEach(async () => {
    await seedUser('seller-1')
    await seedAuction('a-mid', {
      status: 'active',
      minBidCents: 20_000,
      finalPriceCents: 30_000,
      endsAt: '2026-09-05T00:00:00.000Z',
    })
    await seedAuction('a-early', {
      status: 'active',
      minBidCents: 10_000,
      finalPriceCents: 50_000,
      endsAt: '2026-09-01T00:00:00.000Z',
    })
    await seedAuction('a-late', {
      status: 'active',
      minBidCents: 30_000,
      finalPriceCents: 20_000,
      endsAt: '2026-09-10T00:00:00.000Z',
    })
  })

  it('sorts by endTime ascending by default', async () => {
    const result = await listAuctions(repos, new URLSearchParams(''))
    expect(result.auctions.map((a) => a.id)).toEqual(['a-early', 'a-mid', 'a-late'])
  })

  it('sorts by startPrice and by endPrice with order', async () => {
    const byStart = await listAuctions(repos, new URLSearchParams('sort=startPrice'))
    expect(byStart.auctions.map((a) => a.id)).toEqual(['a-early', 'a-mid', 'a-late'])

    const byEndDesc = await listAuctions(repos, new URLSearchParams('sort=endPrice&order=desc'))
    expect(byEndDesc.auctions.map((a) => a.id)).toEqual(['a-early', 'a-mid', 'a-late'])
  })

  it('returns page metadata and slices the list', async () => {
    const page1 = await listAuctions(repos, new URLSearchParams('limit=2&page=1'))
    expect(page1.total).toBe(3)
    expect(page1.totalPages).toBe(2)
    expect(page1.limit).toBe(2)
    expect(page1.auctions.map((a) => a.id)).toEqual(['a-early', 'a-mid'])

    const page2 = await listAuctions(repos, new URLSearchParams('limit=2&page=2'))
    expect(page2.auctions.map((a) => a.id)).toEqual(['a-late'])
  })

  it('clamps a page beyond the range onto the last page', async () => {
    const result = await listAuctions(repos, new URLSearchParams('limit=2&page=99'))
    expect(result.page).toBe(2)
    expect(result.auctions).toHaveLength(1)
  })

  it('never exposes reservePrice in list responses', async () => {
    await seedAuction('a-reserve', { status: 'active', reservePriceCents: 999_999 })
    const result = await listAuctions(repos, new URLSearchParams(''))
    const json = JSON.stringify(result)
    expect(json).not.toContain('reservePrice')
    expect(json).not.toContain('999999')
    expect(json).not.toContain('999_999')
  })
})

describe('listAuctionMapPoints', () => {
  it('returns every match with coordinates and no paging fields', async () => {
    await seedUser('seller-1')
    await seedAuction('a-map-1', {
      status: 'active',
      coordinates: { lat: 59.1, lng: 24.1 },
    })
    await seedAuction('a-map-2', {
      status: 'active',
      coordinates: [58.5, 25.5],
    })

    const points = await listAuctionMapPoints(repos, new URLSearchParams('map=1'))
    expect(points).toHaveLength(2)
    expect(points.map((p) => p.id).sort()).toEqual(['a-map-1', 'a-map-2'])
    expect(points[0]?.coordinates).toEqual({ lat: 59.1, lng: 24.1 })
    expect(points[1]?.coordinates).toEqual({ lat: 58.5, lng: 25.5 })
    const json = JSON.stringify(points)
    expect(json).not.toContain('"total"')
    expect(json).not.toContain('"page"')
  })
})

/** ISO-8601 date-time guard used for the createdAt/latestBidAt checks. */
function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)
}

describe('listArchivedAuctions sorts', () => {
  beforeEach(async () => {
    await seedUser('seller-1')
    await seedAuction('arch-a', {
      status: 'ended',
      minBidCents: 20_000,
      finalPriceCents: 30_000,
      endsAt: '2026-09-01T00:00:00.000Z',
      endYear: 2026,
    })
    await seedAuction('arch-b', {
      status: 'archived',
      minBidCents: 50_000,
      finalPriceCents: 90_000,
      endsAt: '2026-09-05T00:00:00.000Z',
      endYear: 2025,
    })
  })

  it('offers all six archive sort combinations', () => {
    expect(ARCHIVE_SORT_OPTIONS.map((option) => `${option.field}:${option.direction}`)).toEqual([
      'endPrice:desc',
      'endPrice:asc',
      'endTime:desc',
      'endTime:asc',
      'startPrice:desc',
      'startPrice:asc',
    ])
  })

  it('defaults to endPrice descending', async () => {
    const result = await listArchivedAuctions(repos, new URLSearchParams(''))
    expect(result.auctions.map((a) => a.id)).toEqual(['arch-b', 'arch-a'])
  })

  it('sorts by endTime ascending', async () => {
    const result = await listArchivedAuctions(
      repos,
      new URLSearchParams('sort=endTime&order=asc'),
    )
    expect(result.auctions.map((a) => a.id)).toEqual(['arch-a', 'arch-b'])
  })

  it('sorts by startPrice ascending', async () => {
    const result = await listArchivedAuctions(
      repos,
      new URLSearchParams('sort=startPrice&order=asc'),
    )
    expect(result.auctions.map((a) => a.id)).toEqual(['arch-a', 'arch-b'])
  })
})

describe('archivedStatsByObjectType', () => {
  it('aggregates count, area, volume and final-price sums per type', async () => {
    await seedUser('seller-1')
    await seedAuction('arch-a', {
      status: 'ended',
      finalPriceCents: 30_000,
      endYear: 2026,
      packageRows: [{ area: 10, volume: 500 }],
    })
    await seedAuction('arch-b', {
      status: 'archived',
      finalPriceCents: 90_000,
      endYear: 2025,
      packageRows: [{ area: 5.5, volume: 250 }],
    })
    await seedAuction('arch-unsold', {
      status: 'unsold',
      objectType: 'kinnistu',
      finalPriceCents: null,
      endYear: 2025,
    })

    const stats = await archivedStatsByObjectType(repos)
    expect(stats.raieoigus).toEqual({
      count: 2,
      areaHa: 15.5,
      volumeM3: 750,
      finalPriceEur: 1200,
      endYears: [2026, 2025],
    })
    expect(stats.kinnistu).toEqual({
      count: 1,
      areaHa: 0,
      volumeM3: 0,
      finalPriceEur: 0,
      endYears: [2025],
    })
  })
})

describe('getAuctionBids role shaping', () => {
  beforeEach(async () => {
    await seedUser('user-me')
    await seedUser('user-other')
    await seedUser('user-third')
  })

  it('gives guests only the bid count and latest bid time', async () => {
    await seedAuction('a-open', { status: 'active' })
    await seedBid('bid-1', { auctionId: 'a-open', userId: 'user-me', amountCents: 15_000 })
    await seedBid('bid-2', {
      auctionId: 'a-open',
      userId: 'user-other',
      amountCents: 20_000,
      source: 'autobidder',
    })

    const view = await getAuctionBids(repos, 'a-open', null)
    expect(view?.kind).toBe('guest')
    if (view?.kind !== 'guest') throw new Error('expected a guest view')
    expect(view.bidCount).toBe(2)
    expect(isIsoDateTime(view.latestBidAt)).toBe(true)
    expect(JSON.stringify(view)).not.toContain('amountCents')
    expect(JSON.stringify(view)).not.toContain('"bids"')
  })

  it('shapes authed rows with amounts, stable labels, times, source and isOwn', async () => {
    await seedAuction('a-open', { status: 'active' })
    // Higher amount but later stable index; labels follow time order.
    await seedBid('bid-2', {
      auctionId: 'a-open',
      userId: 'user-other',
      amountCents: 25_000,
      source: 'autobidder',
      createdAt: '2026-01-01T00:00:02.000Z',
    })
    await seedBid('bid-1', {
      auctionId: 'a-open',
      userId: 'user-me',
      amountCents: 15_000,
      status: 'outbid',
      createdAt: '2026-01-01T00:00:01.000Z',
    })

    const view = await getAuctionBids(repos, 'a-open', viewer('user-me'))
    expectAuthed(view)
    expect(view.bidCount).toBe(2)
    expect(view.leadingBidAmount).toBe(250)
    expect(
      view.bids.map((b) => [b.id, b.amount, b.label, b.source, b.isOwn]),
    ).toEqual([
      ['bid-2', 250, 'Pakkuja #2', 'autobidder', false],
      ['bid-1', 150, 'Pakkuja #1', 'manual', true],
    ])
    expect(view.bids.map((b) => isIsoDateTime(b.createdAt))).toEqual([true, true])
  })

  it('hides pending-approval bids from other users but shows them to the submitter', async () => {
    await seedAuction('a-open', { status: 'active' })
    await seedBid('bid-1', { auctionId: 'a-open', userId: 'user-other', amountCents: 15_000 })
    await seedBid('bid-pending', {
      auctionId: 'a-open',
      userId: 'user-me',
      amountCents: 30_000,
      status: 'pending_approval',
    })

    // Another authed viewer: the pending bid is invisible.
    const otherView = await getAuctionBids(repos, 'a-open', viewer('user-third'))
    expectAuthed(otherView)
    expect(otherView.bidCount).toBe(1)
    expect(otherView.bids.map((b) => b.id)).toEqual(['bid-1'])

    // The submitter sees their own pending entry on top (higher amount),
    // flagged isOwn, next to the public bid.
    const ownView = await getAuctionBids(repos, 'a-open', viewer('user-me'))
    expectAuthed(ownView)
    expect(ownView.bidCount).toBe(1)
    expect(ownView.bids.map((b) => b.id)).toEqual(['bid-pending', 'bid-1'])
    expect(ownView.bids[0]?.isOwn).toBe(true)
    expect(ownView.bids[0]?.amount).toBe(300)
    expect(ownView.bids[1]?.isOwn).toBe(false)
  })

  it('hides rejected bids from everyone including the submitter', async () => {
    await seedAuction('a-open', { status: 'active' })
    await seedBid('bid-1', { auctionId: 'a-open', userId: 'user-other', amountCents: 15_000 })
    await seedBid('bid-rejected', {
      auctionId: 'a-open',
      userId: 'user-me',
      amountCents: 30_000,
      status: 'rejected',
    })

    const view = await getAuctionBids(repos, 'a-open', viewer('user-me'))
    expectAuthed(view)
    expect(view.bidCount).toBe(1)
    expect(view.bids.map((b) => b.id)).toEqual(['bid-1'])
  })

  it('discloses only the bid count for a running sealed auction', async () => {
    await seedAuction('a-sealed', { status: 'active', type: 'sealed' })
    await seedBid('bid-1', {
      auctionId: 'a-sealed',
      userId: 'user-me',
      amountCents: 15_000,
      type: 'sealed',
    })

    const authed = await getAuctionBids(repos, 'a-sealed', viewer('user-me'))
    expect(authed).toEqual({ kind: 'sealed', bidCount: 1 })

    const guest = await getAuctionBids(repos, 'a-sealed', null)
    expect(guest).toEqual({ kind: 'sealed', bidCount: 1 })
    expect(JSON.stringify(guest)).not.toContain('15')
  })

  it('hides even the count once a sealed auction has ended', async () => {
    await seedAuction('a-sealed', { status: 'ended', type: 'sealed' })
    await seedBid('bid-1', {
      auctionId: 'a-sealed',
      userId: 'user-me',
      amountCents: 15_000,
      type: 'sealed',
    })

    const view = await getAuctionBids(repos, 'a-sealed', viewer('user-me'))
    expect(view).toEqual({ kind: 'sealed', bidCount: null })
  })

  it('returns null for a missing or draft auction', async () => {
    expect(await getAuctionBids(repos, 'no-such', null)).toBeNull()
    await seedAuction('a-draft', { status: 'draft' })
    expect(await getAuctionBids(repos, 'a-draft', null)).toBeNull()
  })
})

describe('getAuctionDossier', () => {
  it('keeps object-shaped loggingType tokens ({code:U}) in the dossier', async () => {
    await seedUser('seller-1')
    await seedAuction('a-logging', {
      status: 'active',
      loggingTypes: [{ code: 'U' }, { code: 'P' }],
    })

    const dossier = await getAuctionDossier(repos, 'a-logging', null)
    expect(dossier).not.toBeNull()
    // Seed data stores objects, not plain strings; stringList drops them
    // so the detail page would render an empty Raieliigid row.
    expect(dossier?.loggingTypes).toEqual(['U', 'P'])
  })

  it('discloses sealed bid count only while running and keeps reservePrice hidden', async () => {
    await seedUser('seller-1')
    await seedAuction('a-sealed', {
      status: 'active',
      type: 'sealed',
      reservePriceCents: 123_456,
    })
    await seedBid('bid-1', {
      auctionId: 'a-sealed',
      userId: 'seller-1',
      amountCents: 15_000,
      type: 'sealed',
    })

    const dossier = await getAuctionDossier(repos, 'a-sealed', viewer('seller-1'))
    expect(dossier?.bidCount).toBe(1)
    const json = JSON.stringify(dossier)
    expect(json).not.toContain('reservePrice')
    expect(json).not.toContain('123456')
    expect(json).not.toContain('amountCents')
  })

  it('gives authed viewers participation data on an active open auction', async () => {
    await seedUser('bidder-1')
    await seedUser('bidder-2')
    await seedAuction('a-open', { status: 'active' })
    await seedBid('bid-1', {
      auctionId: 'a-open',
      userId: 'bidder-1',
      amountCents: 15_000,
      status: 'outbid',
    })
    await seedBid('bid-2', { auctionId: 'a-open', userId: 'bidder-2', amountCents: 20_000 })

    const dossier = await getAuctionDossier(repos, 'a-open', viewer('bidder-1'))
    expect(dossier?.leadingBidAmount).toBe(200)
    expect(dossier?.participation).toEqual({
      hasBid: true,
      hasAutobidder: false,
      isLeading: false,
    })

    const guestDossier = await getAuctionDossier(repos, 'a-open', null)
    expect(guestDossier?.leadingBidAmount).toBeNull()
    expect(guestDossier?.participation).toBeNull()
  })
})
