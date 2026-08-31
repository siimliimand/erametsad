import { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }))

vi.mock('@/env', () => ({
  env: {
    SMTP_FROM: 'noreply@erametsad.ee',
    NEXT_PUBLIC_APP_URL: 'https://erametsad.ww0.dev',
  },
}))

vi.mock('@/lib/notifications/email-sender', () => ({
  sendEmail: sendEmailMock,
  marketingEmailHeaders: () => ({
    'List-Unsubscribe': '<mailto:unsubscribe@erametsad.ww0.dev?subject=unsubscribe>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { GET as confirmRoute } from '@/app/api/v1/newsletter/confirm/route'
import { POST as subscribeRoute } from '@/app/api/v1/newsletter/route'
import { GET as unsubscribeRoute } from '@/app/api/v1/newsletter/unsubscribe/route'
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
import { getRepositories } from '@/lib/data/runtime'
import { setD1ForTests } from '@/lib/db'

const BASE = 'http://localhost:3000/api/v1/newsletter'

let testDb: SqliteTestDb
let repos: CoreRepositories

beforeEach(() => {
  sendEmailMock.mockReset()
  sendEmailMock.mockResolvedValue({ success: true, transport: 'email-binding' })
  testDb = createSqliteTestDb()
  repos = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: sqliteBatchRunner(testDb.raw),
  })
  vi.mocked(getRepositories).mockImplementation(() => Promise.resolve(repos))
  setD1ForTests(testDb.d1)
})

afterEach(() => {
  setD1ForTests(null)
  testDb.close()
})

// newsletterRateLimiter allows 5 requests per minute per bucket, and the
// subscribe/confirm/unsubscribe buckets are keyed by x-forwarded-for, so
// every request uses its own address.
function subscribeRequest(body: Record<string, unknown>, ip = '10.1.0.1'): NextRequest {
  return new NextRequest(BASE, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  })
}

function confirmRequest(token: string, ip = '10.2.0.1'): NextRequest {
  return new NextRequest(`${BASE}/confirm?token=${encodeURIComponent(token)}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

function unsubscribeRequest(token: string, ip = '10.3.0.1'): NextRequest {
  return new NextRequest(`${BASE}/unsubscribe?token=${encodeURIComponent(token)}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

function subscriberRow(email: string):
  | {
      id: string
      email: string
      status: string
      token_hash: string | null
      confirmed_at: string | null
      unsubscribed_at: string | null
    }
  | undefined {
  return testDb.raw
    .prepare(
      'SELECT id, email, status, token_hash, confirmed_at, unsubscribed_at FROM newsletter_subscribers WHERE email = ?',
    )
    .get(email) as
    | {
        id: string
        email: string
        status: string
        token_hash: string | null
        confirmed_at: string | null
        unsubscribed_at: string | null
      }
    | undefined
}

function subscriberCount(): number {
  return (
    testDb.raw.prepare('SELECT COUNT(*) AS n FROM newsletter_subscribers').get() as { n: number }
  ).n
}

async function subscribe(
  email: string,
  ip: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await subscribeRoute(subscribeRequest({ email, company_website: '' }, ip))
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

function tokenFromEmailHtml(): string {
  const call = sendEmailMock.mock.calls[0]
  if (call === undefined) throw new Error('sendEmail was not called')
  const options = call[0] as { html: string }
  const match = /token=([0-9a-f-]+)/.exec(options.html)
  if (match?.[1] === undefined) throw new Error('confirm URL missing from email html')
  return match[1]
}

describe('POST /api/v1/newsletter validation', () => {
  it('rejects a malformed email with 400 and stores nothing', async () => {
    const result = await subscribe('pole-email', '10.1.1.1')

    expect(result.status).toBe(400)
    expect(result.body).toEqual({ error: 'Sobimatu e-posti aadress' })
    expect(subscriberCount()).toBe(0)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('rejects a missing email with 400', async () => {
    const response = await subscribeRoute(
      subscribeRequest({ company_website: '' }, '10.1.1.2'),
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Sobimatu e-posti aadress' })
    expect(subscriberCount()).toBe(0)
  })

  it('returns the neutral success without storing a row when the honeypot is filled', async () => {
    const response = await subscribeRoute(
      subscribeRequest({ email: 'robot@example.ee', company_website: 'spam.example' }, '10.1.1.3'),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'ok',
      message: 'Kui e-posti aadress pole juba uudiskirjas, saadeti kinnituskiri aadressile',
    })
    expect(subscriberCount()).toBe(0)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/newsletter subscribe', () => {
  it('creates a pending subscriber and sends the confirmation email', async () => {
    const result = await subscribe('uus@example.ee', '10.1.2.1')

    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      status: 'ok',
      message: 'Kui e-posti aadress pole juba uudiskirjas, saadeti kinnituskiri aadressile',
    })

    const row = subscriberRow('uus@example.ee')
    expect(row?.status).toBe('pending')
    expect(row?.token_hash).toMatch(/^[0-9a-f]{64}$/)

    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const options = sendEmailMock.mock.calls[0]?.[0] as {
      from: string
      to: string
      subject: string
      html: string
      headers: Record<string, string>
    }
    expect(options.from).toBe('noreply@erametsad.ee')
    expect(options.to).toBe('uus@example.ee')
    expect(options.subject).toBe('Kinnitage uudiskirja tellimus')
    expect(options.headers['List-Unsubscribe']).toContain('mailto:')
    // The emailed link carries the raw token; only its hash is stored.
    const token = tokenFromEmailHtml()
    expect(options.html).toContain(
      `https://erametsad.ww0.dev/api/v1/newsletter/confirm?token=${token}`,
    )
    expect(row?.token_hash).toBe(createHash('sha256').update(token).digest('hex'))
  })

  it('returns the neutral success for a duplicate address with no new row and no resend', async () => {
    await subscribe('duplikaat@example.ee', '10.1.2.2')
    expect(sendEmailMock).toHaveBeenCalledTimes(1)

    const result = await subscribe('duplikaat@example.ee', '10.1.2.3')

    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      status: 'ok',
      message: 'Kui e-posti aadress pole juba uudiskirjas, saadeti kinnituskiri aadressile',
    })
    expect(subscriberCount()).toBe(1)
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
  })
})

describe('GET /api/v1/newsletter/confirm', () => {
  it('confirms a pending subscriber and consumes the token in the same step', async () => {
    await subscribe('kinnitaja@example.ee', '10.1.3.1')
    const token = tokenFromEmailHtml()
    expect(subscriberRow('kinnitaja@example.ee')?.status).toBe('pending')

    const response = await confirmRoute(confirmRequest(token))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'ok',
      message: 'Uudiskirja tellimus on kinnitatud',
    })
    const row = subscriberRow('kinnitaja@example.ee')
    expect(row?.status).toBe('confirmed')
    expect(row?.token_hash).toBeNull()
    expect(row?.confirmed_at).toEqual(expect.any(String))

    // Single use: the replayed link matches no row.
    const replay = await confirmRoute(confirmRequest(token, '10.2.0.9'))
    expect(replay.status).toBe(404)
    expect(await replay.json()).toEqual({ error: 'Link on kehtetu või juba kasutatud' })
  })

  it('rejects an unknown token with 404 and a missing token with 400', async () => {
    const unknown = await confirmRoute(confirmRequest('0'.repeat(36)))
    expect(unknown.status).toBe(404)

    const missing = await confirmRoute(new NextRequest(`${BASE}/confirm`))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'Kinnitustoken puudub' })
  })
})

describe('GET /api/v1/newsletter/unsubscribe', () => {
  it('unsubscribes a pending subscriber by token and blocks the replay', async () => {
    await subscribe('lahkuja@example.ee', '10.1.4.1')
    const token = tokenFromEmailHtml()

    const response = await unsubscribeRoute(unsubscribeRequest(token))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'ok',
      message: 'Teie e-posti aadress on uudiskirja nimekirjast eemaldatud',
    })
    const row = subscriberRow('lahkuja@example.ee')
    expect(row?.status).toBe('unsubscribed')
    expect(row?.token_hash).toBeNull()
    expect(row?.unsubscribed_at).toEqual(expect.any(String))

    const replay = await unsubscribeRoute(unsubscribeRequest(token, '10.3.0.9'))
    expect(replay.status).toBe(404)
  })

  it('refuses the unsubscribe link once the token was consumed by confirming', async () => {
    await subscribe('kinnitatud@example.ee', '10.1.4.2')
    const token = tokenFromEmailHtml()
    expect((await confirmRoute(confirmRequest(token))).status).toBe(200)

    // Confirming nulls the stored hash, so the same link cannot
    // unsubscribe afterwards.
    const response = await unsubscribeRoute(unsubscribeRequest(token))
    expect(response.status).toBe(404)
    expect(subscriberRow('kinnitatud@example.ee')?.status).toBe('confirmed')
  })

  it('rejects a missing token with 400', async () => {
    const response = await unsubscribeRoute(new NextRequest(`${BASE}/unsubscribe`))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Eemaldamistoken puudub' })
  })
})
