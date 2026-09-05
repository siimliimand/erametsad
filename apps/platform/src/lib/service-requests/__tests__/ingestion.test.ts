import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DuplicateServiceRequestError,
  HoneypotTriggeredError,
  ServiceRequestValidationError,
  ingestServiceRequest,
  type ServiceRequestServices,
} from '../ingestion'

import { createSqliteTestDb, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import {
  createPartnersRepository,
  createServiceRequestsRepository,
} from '@/lib/data/repositories'


let testDb: SqliteTestDb
let services: ServiceRequestServices

beforeEach(() => {
  testDb = createSqliteTestDb()
  services = {
    serviceRequests: createServiceRequestsRepository(testDb.database),
    partners: createPartnersRepository(testDb.database),
  }
})

afterEach(() => {
  testDb.close()
})

const contact = {
  name: 'Mati Mets',
  phone: '+37251234567',
  email: 'mati@mets.ee',
}

const kavaBody = {
  type: 'kava',
  contact,
  cadastres: '12345:001:0001, 67890:002:0003',
  comment: '  Palun pakkumine  ',
}

const hooldusraieBody = {
  type: 'hooldusraie',
  contact,
  county: 'TA',
  cadastres: ['12345:001:0001'],
  provisions: 'Raie ja välavedu',
  services: ['hooldamine'],
}

interface SeedPartner {
  serviceTypes: string[]
  counties?: string[] | null
  active?: boolean
}

async function seedPartner(id: string, data: SeedPartner): Promise<void> {
  await services.partners.create({
    id,
    name: `Partner ${id}`,
    serviceTypes: data.serviceTypes,
    counties: data.counties ?? null,
    ...(data.active !== undefined ? { active: data.active } : {}),
  })
}

interface SeedRequest {
  phone: string
  cadastres: string[]
  /** ISO timestamp stored as the row's createdAt. */
  createdAt?: string
}

async function seedRequest(data: SeedRequest): Promise<void> {
  // A dedicated repo instance pins `now` so seeded rows can be older than
  // the 10-minute throttle window.
  const createdAt = data.createdAt
  const repo = createServiceRequestsRepository(
    testDb.database,
    createdAt === undefined ? {} : { now: () => createdAt },
  )
  await repo.create({
    type: 'kava',
    payload: {
      type: 'kava',
      contact: { ...contact, phone: data.phone },
      phone: data.phone,
      cadastres: data.cadastres,
    },
    consentAt: '2026-01-01T00:00:00Z',
    formName: 'metsamajanduskava',
    status: 'routed',
    routedTo: [],
  })
}

function ingest(body: Record<string, unknown>, requestIp?: string) {
  return ingestServiceRequest(
    {
      body,
      formName: 'metsamajanduskava',
      pageSlug: '/paringud/metsamajanduskava',
      consentAt: '2026-01-01T00:00:00Z',
      ...(requestIp !== undefined ? { requestIp } : {}),
    },
    services,
  )
}

describe('ingestServiceRequest', () => {
  describe('honeypot', () => {
    it('rejects a filled honeypot field and creates no row', async () => {
      await expect(
        ingest({ ...kavaBody, company_website: 'https://spam.ee' }),
      ).rejects.toBeInstanceOf(HoneypotTriggeredError)
      expect(await services.serviceRequests.list()).toHaveLength(0)
    })

    it('accepts an empty honeypot field', async () => {
      const result = await ingest({ ...kavaBody, company_website: '' })
      expect(result.request.id).toBeTruthy()
    })
  })

  describe('payload validation and normalization', () => {
    it('rejects an invalid payload with the schema message', async () => {
      await expect(ingest({ ...kavaBody, contact: { ...contact, phone: '123' } })).rejects.toThrow(
        new ServiceRequestValidationError(
          'Sisestage kehtiv Eesti telefoninumber (nt +37251234567)',
        ),
      )
      expect(await services.serviceRequests.list()).toHaveLength(0)
    })

    it('rejects an unknown type', async () => {
      await expect(ingest({ ...kavaBody, type: 'raie' })).rejects.toBeInstanceOf(
        ServiceRequestValidationError,
      )
    })

    it('normalizes cadastres and trims comment before persistence', async () => {
      const { request } = await ingest(kavaBody)
      expect(request.payload).toMatchObject({
        cadastres: ['12345:001:0001', '67890:002:0003'],
        comment: 'Palun pakkumine',
      })
    })
  })

  describe('duplicate throttle', () => {
    it('rejects the same phone and cadastre within 10 minutes', async () => {
      await ingest(kavaBody)
      await expect(ingest(kavaBody)).rejects.toBeInstanceOf(DuplicateServiceRequestError)
    })

    it('uses the Estonian throttle message', async () => {
      await ingest(kavaBody)
      await expect(ingest(kavaBody)).rejects.toThrow('Päring on juba saadetud')
    })

    it('rejects on any overlapping cadastre of the submission', async () => {
      await ingest(kavaBody)
      const overlapping = {
        ...kavaBody,
        cadastres: '99999:009:0009, 12345:001:0001',
      }
      await expect(ingest(overlapping)).rejects.toBeInstanceOf(DuplicateServiceRequestError)
    })

    it('allows the same phone with a non-overlapping cadastre', async () => {
      await ingest(kavaBody)
      const fresh = { ...kavaBody, cadastres: '11111:003:0004' }
      const result = await ingest(fresh)
      expect(result.request.id).toBeTruthy()
    })

    it('allows a repeat beyond the 10-minute window', async () => {
      const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000).toISOString()
      await seedRequest({
        phone: contact.phone,
        cadastres: ['12345:001:0001'],
        createdAt: elevenMinutesAgo,
      })
      const result = await ingest(kavaBody)
      expect(result.request.id).toBeTruthy()
    })

    it('ignores other phones when throttling', async () => {
      await seedRequest({ phone: '+37251234568', cadastres: ['12345:001:0001'] })
      const result = await ingest(kavaBody)
      expect(result.request.id).toBeTruthy()
    })
  })

  describe('routing and persistence', () => {
    it('creates a zero-match row as new with empty routed_to', async () => {
      const result = await ingest(kavaBody)
      expect(result.routedCount).toBe(0)
      expect(result.request.status).toBe('new')
      expect(result.request.routedTo).toEqual([])
    })

    it('routes to active partners matching type and county', async () => {
      await seedPartner('p-tartu', { serviceTypes: ['hooldusraie'], counties: ['TA'] })
      await seedPartner('p-all', { serviceTypes: ['hooldusraie'], counties: null })
      await seedPartner('p-harju', { serviceTypes: ['hooldusraie'], counties: ['HH'] })
      await seedPartner('p-inactive', {
        serviceTypes: ['hooldusraie'],
        counties: null,
        active: false,
      })
      await seedPartner('p-kava', { serviceTypes: ['kava'], counties: null })

      const result = await ingest(hooldusraieBody)

      expect(result.routedCount).toBe(2)
      expect(result.request.status).toBe('routed')
      const routedTo = result.request.routedTo ?? []
      expect([...routedTo].sort()).toEqual(['p-all', 'p-tartu'])
    })

    it('matches kava partners regardless of their county coverage', async () => {
      await seedPartner('p-harju', { serviceTypes: ['kava'], counties: ['HH'] })
      const result = await ingest(kavaBody)
      expect(result.routedCount).toBe(1)
      expect(result.request.routedTo).toEqual(['p-harju'])
      expect(result.request.status).toBe('routed')
    })

    it('stores routed_to as a JSON id array, the payload, and a server-side ip hash', async () => {
      await seedPartner('p-tartu', { serviceTypes: ['hooldusraie'], counties: ['TA'] })

      const { request } = await ingest(hooldusraieBody, '203.0.113.7')

      const raw = testDb.raw
        .prepare(
          'select payload, routed_to, status, ip_hash, form_name, page_slug, consent_at from service_requests where id = ?',
        )
        .get(request.id) as {
        payload: string
        routed_to: string
        status: string
        ip_hash: string | null
        form_name: string
        page_slug: string | null
        consent_at: string
      }

      expect(raw.routed_to).toBe('["p-tartu"]')
      expect(raw.status).toBe('routed')
      expect(raw.ip_hash).toMatch(/^[0-9a-f]{64}$/)
      expect(raw.form_name).toBe('metsamajanduskava')
      expect(raw.page_slug).toBe('/paringud/metsamajanduskava')
      expect(raw.consent_at).toBe('2026-01-01T00:00:00Z')

      const storedPayload = JSON.parse(raw.payload) as Record<string, unknown>
      expect(storedPayload).toMatchObject({
        type: 'hooldusraie',
        phone: '+37251234567',
        county: 'TA',
        provisions: 'Raie ja välavedu',
        services: ['hooldamine'],
        cadastres: ['12345:001:0001'],
        contact: { phone: '+37251234567' },
      })
    })

    it('leaves ip_hash null without a request ip', async () => {
      const { request } = await ingest(kavaBody)
      const raw = testDb.raw
        .prepare('select ip_hash from service_requests where id = ?')
        .get(request.id) as { ip_hash: string | null }
      expect(raw.ip_hash).toBeNull()
    })
  })
})
