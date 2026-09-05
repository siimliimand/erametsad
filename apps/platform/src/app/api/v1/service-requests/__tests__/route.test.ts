import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getMediaBucketMock, putMock } = vi.hoisted(() => ({
  getMediaBucketMock: vi.fn(),
  putMock: vi.fn(),
}))

// Keep the real sanitizeFilename/constants; only the bucket binding is faked.
vi.mock('@/app/(admin)/admin/media/_lib/media-upload', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/app/(admin)/admin/media/_lib/media-upload')
  >()
  return { ...actual, getMediaBucket: getMediaBucketMock }
})

import { POST } from '@/app/api/v1/service-requests/route'
import { MAX_ATTACHMENT_BYTES } from '@/lib/service-requests/attachments'
import { createSqliteTestDb, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import { createPartnersRepository } from '@/lib/data/repositories'
import { setD1ForTests } from '@/lib/db'

const BASE = 'http://localhost:3000/api/v1/service-requests'

const CONTACT = { name: 'Mati Mets', phone: '+37251234567', email: 'mati@mets.ee' }

let testDb: SqliteTestDb
let partners: ReturnType<typeof createPartnersRepository>

beforeEach(() => {
  getMediaBucketMock.mockReset()
  putMock.mockReset()
  putMock.mockResolvedValue(undefined)
  getMediaBucketMock.mockResolvedValue({
    put: putMock,
    get: vi.fn(),
    delete: vi.fn(),
  })
  testDb = createSqliteTestDb()
  setD1ForTests(testDb.d1)
  partners = createPartnersRepository(testDb.database)
})

afterEach(() => {
  setD1ForTests(null)
  testDb.close()
})

interface RouteResult {
  status: number
  body: Record<string, unknown>
}

async function post(request: NextRequest): Promise<RouteResult> {
  const response = await POST(request)
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

function errorsOf(result: RouteResult): Record<string, string> {
  return result.body.errors as Record<string, string>
}

function jsonRequest(body: Record<string, unknown>, ip: string): NextRequest {
  return new NextRequest(BASE, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  })
}

function validKava(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'kava',
    contact: CONTACT,
    cadastres: '12345:001:0001',
    company_website: '',
    consentAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function validIstutamine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'istutamine',
    contact: CONTACT,
    county: 'TA',
    cadastres: '12345:001:0001',
    provisions: 'Istutustööd 2 ha',
    services: ['istikud', 'istutamine'],
    company_website: '',
    consentAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function validHooldusraie(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'hooldusraie',
    contact: CONTACT,
    county: 'TA',
    cadastres: '12345:001:0001',
    provisions: 'Raie ja välavedu',
    services: ['hooldamine'],
    company_website: '',
    consentAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function hooldusraieFields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    type: 'hooldusraie',
    name: CONTACT.name,
    phone: CONTACT.phone,
    email: CONTACT.email,
    county: 'TA',
    cadastres: '12345:001:0001',
    provisions: 'Raie ja välavedu',
    services: 'hooldamine',
    company_website: '',
    consentAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function kavaFields(): Record<string, string> {
  return {
    type: 'kava',
    name: CONTACT.name,
    phone: CONTACT.phone,
    email: CONTACT.email,
    cadastres: '12345:001:0001',
    company_website: '',
    consentAt: '2026-01-01T00:00:00Z',
  }
}

interface MultipartFile {
  data: ArrayBuffer
  name: string
  type: string
}

function multipartRequest(
  fields: Record<string, string>,
  file?: MultipartFile,
  ip = '10.6.0.1',
): NextRequest {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value)
  }
  if (file) {
    form.append('file', new File([file.data], file.name, { type: file.type }))
  }
  // The browser boundary in content-type is set by the body itself.
  return new NextRequest(BASE, {
    method: 'POST',
    body: form,
    headers: { 'x-forwarded-for': ip },
  })
}

function serviceRequestCount(): number {
  return (
    testDb.raw.prepare('SELECT COUNT(*) AS n FROM service_requests').get() as { n: number }
  ).n
}

function rawRow(id: string): { payload: string; routed_to: string | null; status: string; attachments: string | null } {
  return testDb.raw
    .prepare(
      'SELECT payload, routed_to, status, attachments FROM service_requests WHERE id = ?',
    )
    .get(id) as {
    payload: string
    routed_to: string | null
    status: string
    attachments: string | null
  }
}

async function seedPartner(
  id: string,
  data: { serviceTypes: string[]; counties?: string[] | null; active?: boolean },
): Promise<void> {
  await partners.create({
    id,
    name: `Partner ${id}`,
    serviceTypes: data.serviceTypes,
    counties: data.counties ?? null,
    ...(data.active !== undefined ? { active: data.active } : {}),
  })
}

describe('POST /api/v1/service-requests validation matrix', () => {
  it('creates a kava request from JSON with routedCount 0 and status new', async () => {
    const result = await post(jsonRequest(validKava(), '10.1.0.1'))

    expect(result.status).toBe(201)
    expect(result.body).toEqual({
      status: 'ok',
      routedCount: 0,
      request: { id: expect.any(String), status: 'new' },
    })
    expect(serviceRequestCount()).toBe(1)
  })

  it('creates an istutamine request from JSON', async () => {
    const result = await post(jsonRequest(validIstutamine(), '10.1.0.2'))

    expect(result.status).toBe(201)
    expect(result.body).toMatchObject({
      status: 'ok',
      request: { status: 'new' },
    })
  })

  it('rejects istutamine without a service selection with a 422 on the service group', async () => {
    const { services: _services, ...withoutServices } = validIstutamine()

    const result = await post(jsonRequest(withoutServices, '10.1.0.3'))

    expect(result.status).toBe(422)
    expect(errorsOf(result).services).toBe('Valige vähemalt üks teenus')
    expect(serviceRequestCount()).toBe(0)
  })

  it('rejects an invalid phone with a 422 on the phone field', async () => {
    const result = await post(
      jsonRequest(validKava({ contact: { ...CONTACT, phone: '123' } }), '10.1.0.4'),
    )

    expect(result.status).toBe(422)
    expect(errorsOf(result)['contact.phone']).toBe(
      'Sisestage kehtiv Eesti telefoninumber (nt +37251234567)',
    )
  })

  it('rejects an invalid email with a 422 on the email field', async () => {
    const result = await post(
      jsonRequest(validKava({ contact: { ...CONTACT, email: 'pole-email' } }), '10.1.0.5'),
    )

    expect(result.status).toBe(422)
    expect(errorsOf(result)['contact.email']).toBe('Sisestage kehtiv e-posti aadress')
  })

  it('rejects a malformed cadastre with a 422 on the cadastre field', async () => {
    const result = await post(jsonRequest(validKava({ cadastres: 'abc' }), '10.1.0.6'))

    expect(result.status).toBe(422)
    expect(errorsOf(result).cadastres).toBe(
      '1. katastriüksus peab vastama vormingule NNNNN:NNN:NNNN',
    )
  })

  it('rejects a missing consent with a 422 on the consent field', async () => {
    const { consentAt: _consentAt, ...withoutConsent } = validKava()

    const result = await post(jsonRequest(withoutConsent, '10.1.0.7'))

    expect(result.status).toBe(422)
    expect(errorsOf(result).consentAt).toBe('Nõusolek on kohustuslik')
    expect(serviceRequestCount()).toBe(0)
  })
})

describe('POST /api/v1/service-requests honeypot', () => {
  it('answers with a neutral success and stores no row when company_website is filled', async () => {
    const result = await post(
      jsonRequest(validKava({ company_website: 'https://spam.ee' }), '10.2.0.1'),
    )

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ status: 'ok' })
    expect(serviceRequestCount()).toBe(0)
    expect(putMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/service-requests duplicate throttle', () => {
  it('returns 409 with the Estonian message for the same phone and cadastre within 10 minutes', async () => {
    const ip = '10.3.0.1'
    const first = await post(jsonRequest(validKava(), ip))
    expect(first.status).toBe(201)

    const second = await post(jsonRequest(validKava(), ip))

    expect(second.status).toBe(409)
    expect(second.body).toEqual({ error: 'Päring on juba saadetud' })
    expect(serviceRequestCount()).toBe(1)
  })
})

describe('POST /api/v1/service-requests routing selection', () => {
  it('reports routedCount for the matched partners and stores them on the row', async () => {
    await seedPartner('p-tartu', { serviceTypes: ['hooldusraie'], counties: ['TA'] })
    await seedPartner('p-all', { serviceTypes: ['hooldusraie'], counties: null })
    await seedPartner('p-harju', { serviceTypes: ['hooldusraie'], counties: ['HH'] })
    await seedPartner('p-inactive', {
      serviceTypes: ['hooldusraie'],
      counties: null,
      active: false,
    })
    await seedPartner('p-kava', { serviceTypes: ['kava'], counties: null })

    const result = await post(jsonRequest(validHooldusraie(), '10.4.0.1'))

    expect(result.status).toBe(201)
    expect(result.body).toMatchObject({
      status: 'ok',
      routedCount: 2,
      request: { status: 'routed' },
    })
    const id = (result.body.request as { id: string }).id
    const row = rawRow(id)
    const routedTo = JSON.parse(row.routed_to ?? '[]') as string[]
    expect([...routedTo].sort()).toEqual(['p-all', 'p-tartu'])
  })

  it('stores a zero-match request as new with routedCount 0', async () => {
    const result = await post(jsonRequest(validIstutamine(), '10.4.0.2'))

    expect(result.status).toBe(201)
    expect(result.body).toEqual({
      status: 'ok',
      routedCount: 0,
      request: { id: expect.any(String), status: 'new' },
    })
  })
})

describe('POST /api/v1/service-requests attachment file rules', () => {
  it('stores a 2 MB PDF from a hooldusraie multipart submission under service-requests/', async () => {
    const file: MultipartFile = {
      data: new ArrayBuffer(2 * 1024 * 1024),
      name: 'hooldusplaen.pdf',
      type: 'application/pdf',
    }

    const result = await post(multipartRequest(hooldusraieFields(), file, '10.5.0.1'))

    expect(result.status).toBe(201)
    expect(putMock).toHaveBeenCalledTimes(1)
    const key = putMock.mock.calls[0]?.[0] as string
    expect(key).toMatch(/^service-requests\//)
    expect(key).toContain('hooldusplaen.pdf')
    const options = putMock.mock.calls[0]?.[2] as { httpMetadata?: { contentType?: string } }
    expect(options.httpMetadata?.contentType).toBe('application/pdf')

    const id = (result.body.request as { id: string }).id
    const stored = JSON.parse(rawRow(id).attachments ?? '[]') as string[]
    expect(stored).toEqual([key])
  })

  it('rejects a DOCX with a 422 file error and stores nothing', async () => {
    const file: MultipartFile = {
      data: new ArrayBuffer(1024),
      name: 'kokkuvote.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }

    const result = await post(multipartRequest(hooldusraieFields(), file, '10.5.0.2'))

    expect(result.status).toBe(422)
    expect(errorsOf(result).file).toBe('Lubatud on ainult PDF-, JPG- ja PNG-failid.')
    expect(putMock).not.toHaveBeenCalled()
    expect(serviceRequestCount()).toBe(0)
  })

  it('rejects a file on a kava request with a 422 file error', async () => {
    const file: MultipartFile = {
      data: new ArrayBuffer(1024),
      name: 'plaan.pdf',
      type: 'application/pdf',
    }

    const result = await post(multipartRequest(kavaFields(), file, '10.5.0.3'))

    expect(result.status).toBe(422)
    expect(errorsOf(result).file).toBe('Faili saab lisada ainult hooldusraie päringule')
    expect(putMock).not.toHaveBeenCalled()
    expect(serviceRequestCount()).toBe(0)
  })

  it('rejects a file larger than 10 MB with a 422 file error', async () => {
    const file: MultipartFile = {
      data: new ArrayBuffer(MAX_ATTACHMENT_BYTES + 1),
      name: 'too-suur.pdf',
      type: 'application/pdf',
    }

    const result = await post(multipartRequest(hooldusraieFields(), file, '10.5.0.4'))

    expect(result.status).toBe(422)
    expect(errorsOf(result).file).toBe('Faili maksimaalne suurus on 10 MB.')
    expect(putMock).not.toHaveBeenCalled()
    expect(serviceRequestCount()).toBe(0)
  })

  it('returns 503 with a file error when no bucket binding is available', async () => {
    getMediaBucketMock.mockResolvedValueOnce(null)

    const file: MultipartFile = {
      data: new ArrayBuffer(1024),
      name: 'hooldus.pdf',
      type: 'application/pdf',
    }
    const result = await post(multipartRequest(hooldusraieFields(), file, '10.5.0.5'))

    expect(result.status).toBe(503)
    expect(errorsOf(result).file).toBe(
      'Faili salvestamine pole praegu saadaval. Proovige mõne aja pärast uuesti.',
    )
    expect(serviceRequestCount()).toBe(0)
  })

  it('returns 503 with a file error when the R2 put fails', async () => {
    putMock.mockRejectedValueOnce(new Error('r2 unreachable'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const file: MultipartFile = {
      data: new ArrayBuffer(1024),
      name: 'hooldus.pdf',
      type: 'application/pdf',
    }
    const result = await post(multipartRequest(hooldusraieFields(), file, '10.5.0.6'))

    expect(result.status).toBe(503)
    expect(errorsOf(result).file).toBe('Faili salvestamine ebaõnnestus. Proovige uuesti.')
    expect(serviceRequestCount()).toBe(0)
    errorSpy.mockRestore()
  })
})

describe('POST /api/v1/service-requests rate limit', () => {
  it('returns 429 on the 6th request within a minute from one IP while other IPs pass', async () => {
    const throttledIp = '10.7.0.1'
    // Consent is missing, so every allowed request answers 422; each still
    // consumes one of the 5 tokens.
    for (let i = 0; i < 5; i += 1) {
      const allowed = await post(jsonRequest({ type: 'kava' }, throttledIp))
      expect(allowed.status).toBe(422)
    }

    const throttled = await post(jsonRequest({ type: 'kava' }, throttledIp))

    expect(throttled.status).toBe(429)
    expect(throttled.body).toEqual({ error: 'Liiga palju päringuid' })

    const otherIp = await post(jsonRequest(validKava(), '10.7.0.2'))
    expect(otherIp.status).toBe(201)
  })
})
