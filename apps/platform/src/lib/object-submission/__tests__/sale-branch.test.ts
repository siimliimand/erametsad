import { beforeEach, describe, expect, it } from 'vitest'

import {
  generateSaleTitle,
  generateAliasEmail,
  ingestSaleSubmission,
  saleAuctionType,
} from '../sale-branch'

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
import type { SaleSubmission } from '@/lib/object-submission'

/**
 * Sale branch ingestion (task 2.1) against the real repository layer on the
 * SQLite pool: one owned draft auction, one portal-sourced lead, county
 * round-robin on both, audit entries for the creates.
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

function submission(overrides: Partial<SaleSubmission> = {}): SaleSubmission {
  return {
    branch: 'sale',
    objectType: 'raieoigus',
    cadastres: ['78402:003:0210'],
    areaHa: 12.4,
    species: ['MA', 'KU'],
    loggingTypes: ['HL'],
    description: 'Müüa raieõigus Harjumaal.',
    contact: { name: 'Mati Mets', phone: '+37251234567', email: 'mati@mets.ee' },
    ...overrides,
  }
}

async function seedCounty(id: string, code: string): Promise<void> {
  await repos.create({ collection: 'counties', data: { id, name: `Maakond ${code}`, code } })
}

async function seedUser(id: string): Promise<void> {
  await repos.create({ collection: 'users', data: { id, email: `${id}@example.ee` } })
}

async function seedSpecialist(
  id: string,
  name: string,
  active = true,
): Promise<void> {
  await repos.create({
    collection: 'specialists',
    data: { id, name, slug: id, active },
  })
}

async function seedAssignedLead(countyId: string, specialistId: string): Promise<void> {
  await repos.create({
    collection: 'leads',
    data: {
      formName: 'Metsa müük',
      contactName: 'Seemne juhtlõng',
      countyId,
      consentAt: NOW,
      status: 'new',
      assignedSpecialist: specialistId,
    },
  })
}

async function seedAuctionWithSlug(slug: string): Promise<void> {
  await repos.create({
    collection: 'auctions',
    data: { title: 'Varasem', slug, objectType: 'raieoigus', minBidCents: 100 },
  })
}

describe('saleAuctionType and generated fields', () => {
  it('defaults mechanics by object type (D7)', () => {
    expect(saleAuctionType('raieoigus')).toBe('open')
    expect(saleAuctionType('kinnistu')).toBe('sealed')
  })

  it('builds the title from the product label and first cadastre', () => {
    expect(generateSaleTitle('raieoigus', ['78402:003:0210'])).toBe('Raieõiguse müük 78402:003:0210')
    expect(generateSaleTitle('kinnistu', ['78402:003:0210'])).toBe('Kinnistu müük 78402:003:0210')
  })

  it('generates alias emails in the admin convention', () => {
    expect(generateAliasEmail()).toMatch(/^mt[0-9a-f]{10}@oksjonid\.erametsad\.ee$/)
  })
})

describe('ingestSaleSubmission', () => {
  it('creates an owned draft auction, portal lead and audit entries', async () => {
    await seedUser('seller-1')
    await seedCounty('c-hh', 'HH')

    const { auction, lead, assignedSpecialistId } = await ingestSaleSubmission(
      submission({
        address: 'Metsa tee 1',
        volumeM3: 320,
        files: ['object-submissions/u1/plan.pdf'],
      }),
      'seller-1',
      { repositories: repos },
    )

    expect(assignedSpecialistId).toBeNull()
    expect(auction).toMatchObject({
      title: 'Raieõiguse müük 78402:003:0210',
      slug: 'raieoiguse-muuk-78402-003-0210',
      status: 'draft',
      objectType: 'raieoigus',
      type: 'open',
      sellerId: 'seller-1',
      minBidCents: 0,
      countyId: 'c-hh',
      address: 'Metsa tee 1',
      areaHa: 12.4,
      volumeM3: 320,
      descriptionPublic: 'Müüa raieõigus Harjumaal.',
    })
    expect(auction.aliasEmail).toMatch(/^mt[0-9a-f]{10}@oksjonid\.erametsad\.ee$/)
    expect(auction.cadastres).toEqual(['78402:003:0210'])
    expect(auction.species).toEqual(['MA', 'KU'])
    expect(auction.loggingTypes).toEqual(['HL'])
    expect(auction.files).toEqual(['object-submissions/u1/plan.pdf'])

    expect(lead).toMatchObject({
      formName: 'Portaal: objekti pakkumine',
      pageSlug: '/user/objects/paku',
      contactName: 'Mati Mets',
      phone: '+37251234567',
      email: 'mati@mets.ee',
      cadastr: '78402:003:0210',
      countyId: 'c-hh',
      source: 'portal',
      status: 'new',
      userId: 'seller-1',
      auctionId: auction.id,
      assignedSpecialistId: null,
    })

    const audits = await repos.find({
      collection: 'audit-entry',
      sort: 'createdAt',
      pagination: false,
    })
    expect(audits.docs.map((entry) => entry.action)).toEqual([
      'auction.create_portal',
      'lead.create_portal',
    ])
    expect(audits.docs[0]).toMatchObject({
      actorId: 'seller-1',
      entityType: 'auction',
      entityId: auction.id,
    })
    expect(audits.docs[1]).toMatchObject({
      actorId: 'seller-1',
      entityType: 'lead',
      entityId: lead.id,
    })
  })

  it('defaults a kinnistu draft to sealed', async () => {
    await seedUser('seller-1')

    const { auction } = await ingestSaleSubmission(
      submission({ objectType: 'kinnistu' }),
      'seller-1',
      { repositories: repos },
    )

    expect(auction.type).toBe('sealed')
    expect(auction.status).toBe('draft')
  })

  it('assigns the county round-robin specialist to both the lead and the draft', async () => {
    await seedUser('seller-1')
    await seedCounty('c-hh', 'HH')
    await seedSpecialist('sp-aadu', 'Aadu')
    await seedSpecialist('sp-bertha', 'Berta')
    await seedAssignedLead('c-hh', 'sp-aadu')

    const { auction, lead, assignedSpecialistId } = await ingestSaleSubmission(
      submission(),
      'seller-1',
      { repositories: repos },
    )

    expect(assignedSpecialistId).toBe('sp-bertha')
    expect(auction.specialistId).toBe('sp-bertha')
    expect(lead.assignedSpecialistId).toBe('sp-bertha')
  })

  it('rotates to the other specialist once the counts level out', async () => {
    await seedUser('seller-1')
    await seedCounty('c-hh', 'HH')
    await seedSpecialist('sp-aadu', 'Aadu')
    await seedSpecialist('sp-bertha', 'Berta')

    const first = await ingestSaleSubmission(submission(), 'seller-1', { repositories: repos })
    expect(first.assignedSpecialistId).toBe('sp-aadu')

    const second = await ingestSaleSubmission(submission(), 'seller-1', { repositories: repos })
    expect(second.assignedSpecialistId).toBe('sp-bertha')
  })

  it('leaves the assignment null when no active specialist exists', async () => {
    await seedUser('seller-1')
    await seedCounty('c-hh', 'HH')
    await seedSpecialist('sp-puhkus', 'Puhkuva', false)

    const { auction, lead, assignedSpecialistId } = await ingestSaleSubmission(
      submission(),
      'seller-1',
      { repositories: repos },
    )

    expect(assignedSpecialistId).toBeNull()
    expect(auction.specialistId).toBeNull()
    expect(lead.assignedSpecialistId).toBeNull()
  })

  it('stores no county when the first cadastre maps to nothing', async () => {
    await seedUser('seller-1')

    const { auction, lead } = await ingestSaleSubmission(
      submission({ cadastres: ['99999:001:0001'] }),
      'seller-1',
      { repositories: repos },
    )

    expect(auction.countyId).toBeNull()
    expect(lead.countyId).toBeNull()
  })

  it('falls back to the payload county when derivation fails', async () => {
    await seedUser('seller-1')
    await seedCounty('c-ta', 'TA')

    const { auction } = await ingestSaleSubmission(
      submission({ cadastres: ['99999:001:0001'], county: 'TA' }),
      'seller-1',
      { repositories: repos },
    )

    expect(auction.countyId).toBe('c-ta')
  })

  it('prefers the derived county over the payload county', async () => {
    await seedUser('seller-1')
    await seedCounty('c-hh', 'HH')
    await seedCounty('c-ta', 'TA')

    const { auction } = await ingestSaleSubmission(submission({ county: 'TA' }), 'seller-1', {
      repositories: repos,
    })

    expect(auction.countyId).toBe('c-hh')
  })

  it('suffixes the slug when the base is taken', async () => {
    await seedUser('seller-1')
    await seedAuctionWithSlug('raieoiguse-muuk-78402-003-0210')

    const { auction } = await ingestSaleSubmission(submission(), 'seller-1', {
      repositories: repos,
    })

    expect(auction.slug.startsWith('raieoiguse-muuk-78402-003-0210-')).toBe(true)
    expect(auction.slug).not.toBe('raieoiguse-muuk-78402-003-0210')
  })
})
