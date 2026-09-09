import { describe, expect, it } from 'vitest'

import {
  buildBidExportRows,
  buildBidsCsv,
  buildBidsExportFilename,
  BID_CSV_HEADERS,
  isUnderbidBid,
  type BidExportContext,
} from './bids-export'

import type { Bid } from '@/lib/data/schema'

function makeBid(overrides: Partial<Bid>): Bid {
  return {
    id: 'bid-1',
    auctionId: 'auction-1',
    userId: 'user-1',
    amountCents: 120_000_00,
    type: 'open',
    source: 'manual',
    status: 'leading',
    identitySnapshot: null,
    ipHash: 'ip-hash-1',
    idempotencyKey: null,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...overrides,
  }
}

const emptyContext: BidExportContext = {
  aliasByUserId: new Map([['user-1', 3]]),
  nameByUserId: new Map([['user-1', 'Mari Maasikas']]),
  includeIdentity: true,
}

describe('buildBidExportRows', () => {
  it('maps the documented columns for a regular bid', () => {
    const rows = buildBidExportRows([makeBid({})], emptyContext)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      submittedAt: '2026-09-01T12:00:00.000Z',
      anonymizedLabel: 'Pakkuja #3',
      bidderId: 'user-1',
      bidderName: 'Mari Maasikas',
      amount: '120000.00',
      source: 'Käsitsi',
      status: 'Juhtiv',
      isUnderbid: 'ei',
      ipHash: 'ip-hash-1',
    })
  })

  it('marks pending_approval bids as alapakkumine', () => {
    const rows = buildBidExportRows(
      [makeBid({ status: 'pending_approval' }), makeBid({ status: 'rejected' })],
      emptyContext,
    )
    expect(rows.map((row) => row.isUnderbid)).toEqual(['jah', 'ei'])
  })

  it('blanks identity columns for non-admin exporters', () => {
    const rows = buildBidExportRows([makeBid({})], {
      ...emptyContext,
      includeIdentity: false,
    })
    expect(rows[0]?.bidderId).toBe('')
    expect(rows[0]?.bidderName).toBe('')
    expect(rows[0]?.anonymizedLabel).toBe('Pakkuja #3')
    expect(rows[0]?.ipHash).toBe('ip-hash-1')
  })

  it('hides the amount of sealed bids and keeps the rest', () => {
    const rows = buildBidExportRows(
      [makeBid({ type: 'sealed', amountCents: 0, source: 'autobidder' })],
      emptyContext,
    )
    expect(rows[0]?.amount).toBe('')
    expect(rows[0]?.source).toBe('Automaatpakkuja')
    expect(rows[0]?.ipHash).toBe('ip-hash-1')
  })

  it('falls back to an empty label when the alias is missing', () => {
    const rows = buildBidExportRows([makeBid({ userId: 'user-x' })], emptyContext)
    expect(rows[0]?.anonymizedLabel).toBe('')
  })
})

describe('isUnderbidBid', () => {
  it('treats only the pending_approval status as an alapakkumine', () => {
    expect(isUnderbidBid({ status: 'pending_approval' })).toBe(true)
    expect(isUnderbidBid({ status: 'leading' })).toBe(false)
    expect(isUnderbidBid({ status: 'rejected' })).toBe(false)
  })
})

describe('buildBidsCsv', () => {
  it('starts with a UTF-8 BOM and emits the Estonian header row', () => {
    const csv = buildBidsCsv([])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1).split('\r\n')[0]).toBe(BID_CSV_HEADERS.join(';'))
  })

  it('exposes every documented column incl. source/status/is_underbid/ip_hash', () => {
    expect(BID_CSV_HEADERS).toEqual([
      'Esitatud',
      'Pakkuja (anonüümne)',
      'Pakkuja ID',
      'Pakkuja nimi',
      'Summa (EUR)',
      'Allikas',
      'Olek',
      'Alapakkumine',
      'IP räsi',
    ])
  })

  it('quotes fields containing the delimiter, quotes or newlines', () => {
    const csv = buildBidsCsv([
      {
        submittedAt: '01.09 12:00',
        anonymizedLabel: 'Pakkuja #3',
        bidderId: 'user-1',
        bidderName: 'Mari "M"; Maasikas',
        amount: '120000.00',
        source: 'Käsitsi',
        status: 'Juhtiv',
        isUnderbid: 'ei',
        ipHash: 'ip-hash-1',
      },
    ])
    const [, dataLine] = csv.slice(1).split('\r\n')
    expect(dataLine).toBe(
      '01.09 12:00;Pakkuja #3;user-1;"Mari ""M""; Maasikas";120000.00;Käsitsi;Juhtiv;ei;ip-hash-1',
    )
    expect(csv.endsWith('\r\n')).toBe(true)
  })
})

describe('buildBidsExportFilename', () => {
  it('uses the auction id and the ISO date', () => {
    expect(buildBidsExportFilename('auction-1', new Date('2026-09-09T12:00:00.000Z'))).toBe(
      'pakkumised-auction-1-2026-09-09.csv',
    )
  })
})
