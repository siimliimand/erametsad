import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/leads/ingestion', () => ({
  ingestLead: vi.fn(),
  validateHoneypot: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => {
  const mockCheck = vi.fn()
  return {
    leadsRateLimiter: { check: mockCheck },
    __mockCheck: mockCheck,
  }
})

vi.mock('@/lib/bidding/place-bid', () => ({
  computeIpHash: vi.fn((ip: string) => `hash-${ip}`),
}))

import { POST } from '@/app/api/leads/route'
import { ingestLead, validateHoneypot } from '@/lib/leads/ingestion'
import { leadsRateLimiter } from '@/lib/rate-limit'
import { computeIpHash } from '@/lib/bidding/place-bid'

const mockCheck = vi.mocked(leadsRateLimiter.check)
const mockIngest = vi.mocked(ingestLead)
const mockHoneypot = vi.mocked(validateHoneypot)

function makeRequest(body: Record<string, unknown>, ip?: string): Request {
  const headers = new Headers()
  if (ip) headers.set('x-forwarded-for', ip)
  return new Request('http://localhost/api/leads', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

const validBody = {
  formName: 'mets',
  contactName: 'Mart Tamm',
  phone: '+3725123456',
  email: 'mart@example.com',
  consentAt: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheck.mockReturnValue({ allowed: true, limit: 5, remaining: 4, reset: Date.now() + 60_000 })
  mockHoneypot.mockReturnValue(true)
  mockIngest.mockResolvedValue({ id: 'lead-1' })
})

describe('POST /api/leads', () => {
  describe('rate limiter (5/min/IP)', () => {
    it('allows the first 5 requests from the same IP', async () => {
      for (let i = 0; i < 5; i++) {
        mockCheck.mockReturnValue({ allowed: true, limit: 5, remaining: 5 - i - 1, reset: Date.now() + 60_000 })
        const res = await POST(makeRequest(validBody))
        expect(res.status).toBe(201)
      }
      expect(mockCheck).toHaveBeenCalledTimes(5)
    })

    it('blocks the 6th request with 429', async () => {
      mockCheck.mockReturnValue({ allowed: false, limit: 5, remaining: 0, reset: Date.now() + 60_000 })
      const res = await POST(makeRequest(validBody))
      expect(res.status).toBe(429)
      const json = await res.json()
      expect(json.error).toBe('Liiga palju päringuid')
    })

    it('uses the dedicated leads limiter, not the shared API limiter', async () => {
      await POST(makeRequest(validBody))
      expect(mockCheck).toHaveBeenCalled()
    })
  })

  describe('honeypot', () => {
    it('returns fake success (200) when honeypot is triggered', async () => {
      mockHoneypot.mockReturnValue(false)
      const res = await POST(makeRequest({ ...validBody, company_website: 'https://spam.com' }))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.status).toBe('ok')
      expect(mockIngest).not.toHaveBeenCalled()
    })
  })

  describe('validation', () => {
    it('rejects missing contactName with Estonian error', async () => {
      const res = await POST(makeRequest({ ...validBody, contactName: '' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Nimi on kohustuslik')
    })

    it('rejects invalid phone with Estonian error', async () => {
      const res = await POST(makeRequest({ ...validBody, phone: '123' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Sobimatu telefoninumber')
    })

    it('rejects invalid email with Estonian error', async () => {
      const res = await POST(makeRequest({ ...validBody, email: 'not-an-email' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Sobimatu e-posti aadress')
    })

    it('rejects missing consentAt with Estonian error', async () => {
      const res = await POST(makeRequest({ ...validBody, consentAt: '' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Nõusolek on kohustuslik')
    })
  })

  describe('ipHash computed server-side', () => {
    it('computes ipHash from the request IP, ignoring any client-supplied value', async () => {
      await POST(makeRequest(validBody, '192.168.1.1'))
      expect(computeIpHash).toHaveBeenCalledWith('192.168.1.1')
      expect(mockIngest).toHaveBeenCalledWith(
        expect.objectContaining({ ipHash: 'hash-192.168.1.1' }),
      )
    })
  })

  describe('no error leakage', () => {
    it('returns generic error on internal failure', async () => {
      mockIngest.mockRejectedValue(new Error('SQL connection failed'))
      const res = await POST(makeRequest(validBody))
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.error).toBe('Sisemine viga')
      expect(json.error).not.toContain('SQL')
    })
  })
})