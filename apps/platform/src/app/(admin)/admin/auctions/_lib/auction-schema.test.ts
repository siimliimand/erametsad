import { describe, expect, it } from 'vitest'

import {
  ANTI_SNIPE_MAX_MINUTES,
  ANTI_SNIPE_MIN_MINUTES,
  CADASTRE_PATTERN,
  applyQuickAuctionDefaults,
  auctionInputSchema,
  collectPublishGateFailures,
  slugifyTitle,
  toAuctionWriteData,
  type AuctionGateSubject,
} from './auction-schema'

const validBase = {
  title: 'Lepsi raieõigus',
  objectType: 'raieoigus',
  auctionType: 'open',
  bidStepEur: 50,
  minBidEur: 3000,
  volumeM3: 980,
  startsAt: '2026-09-10T10:00:00.000Z',
  endsAt: '2026-09-12T10:00:00.000Z',
  cadastres: ['34801:001:0217'],
  countyId: 'county-1',
  parishId: 'parish-1',
} satisfies Record<string, unknown>

function gateSubject(overrides: Partial<AuctionGateSubject> = {}): AuctionGateSubject {
  return {
    objectType: 'raieoigus',
    type: 'open',
    isQuickAuction: false,
    startsAt: '2026-09-10T10:00:00.000Z',
    endsAt: '2026-09-12T10:00:00.000Z',
    minBidCents: 300000,
    reservePriceCents: null,
    cadastres: ['34801:001:0217'],
    countyId: 'county-1',
    parishId: 'parish-1',
    packageRows: [{ area: 12.4, volume: 980 }],
    media: [],
    ...overrides,
  }
}

describe('cadastral number format', () => {
  it('accepts the NNNNN:NNN:NNNN pattern', () => {
    expect(CADASTRE_PATTERN.test('34801:001:0217')).toBe(true)
  })

  it('rejects wrong shapes', () => {
    expect(CADASTRE_PATTERN.test('3480:001:0217')).toBe(false)
    expect(CADASTRE_PATTERN.test('34801:01:0217')).toBe(false)
    expect(CADASTRE_PATTERN.test('34801:001:217')).toBe(false)
    expect(CADASTRE_PATTERN.test('abc01:001:0217')).toBe(false)
  })

  it('flags each invalid cadastre on the input', () => {
    const parsed = auctionInputSchema.safeParse({
      ...validBase,
      cadastres: ['34801:001:0217', 'bad'],
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path[0] === 'cadastres')).toBe(true)
    }
  })
})

describe('forced sealed for property and package lots', () => {
  it('rejects an open property lot', () => {
    const parsed = auctionInputSchema.safeParse({
      ...validBase,
      objectType: 'kinnistu',
      auctionType: 'open',
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message.includes('pimepakkumisega'))).toBe(true)
    }
  })

  it('rejects an open package lot', () => {
    const parsed = auctionInputSchema.safeParse({
      ...validBase,
      objectType: 'pakett',
      auctionType: 'open',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts a sealed property lot', () => {
    const parsed = auctionInputSchema.safeParse({
      ...validBase,
      objectType: 'kinnistu',
      auctionType: 'sealed',
      bidStepEur: undefined,
    })
    expect(parsed.success).toBe(true)
  })
})

describe('kiiroksjon rules', () => {
  const quickBase = {
    ...validBase,
    isQuickAuction: true,
    minBidEur: undefined,
    reservePriceEur: undefined,
    startsAt: '2026-09-10T10:00:00.000Z',
    endsAt: '2026-09-12T10:00:00.000Z',
  }

  it('requires a reserve price', () => {
    const parsed = auctionInputSchema.safeParse(quickBase)
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path[0] === 'reservePriceEur')).toBe(true)
    }
  })

  it('rejects a window outside 24-72 hours', () => {
    const parsed = auctionInputSchema.safeParse({
      ...quickBase,
      reservePriceEur: 5000,
      endsAt: '2026-09-11T09:00:00.000Z',
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message.includes('24–72'))).toBe(true)
    }
  })

  it('accepts a 48 hour window with a reserve', () => {
    const parsed = auctionInputSchema.safeParse({
      ...quickBase,
      reservePriceEur: 5000,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      const normalized = applyQuickAuctionDefaults(parsed.data)
      expect(normalized.minBidEur).toBe(1)
    }
  })

  it('keeps a raised starting price on a kiiroksjon', () => {
    const parsed = auctionInputSchema.safeParse({
      ...quickBase,
      reservePriceEur: 5000,
      minBidEur: 25,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(applyQuickAuctionDefaults(parsed.data).minBidEur).toBe(25)
    }
  })

  it('coerces objectType kiire into a quick auction', () => {
    const parsed = auctionInputSchema.safeParse({
      ...quickBase,
      objectType: 'kiire',
      reservePriceEur: 5000,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(applyQuickAuctionDefaults(parsed.data).isQuickAuction).toBe(true)
    }
  })
})

describe('time rules', () => {
  it('rejects a duration under one hour', () => {
    const parsed = auctionInputSchema.safeParse({
      ...validBase,
      endsAt: '2026-09-10T10:30:00.000Z',
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message.includes('vähemalt 1 tund'))).toBe(true)
    }
  })

  it('rejects a duration over 90 days', () => {
    const parsed = auctionInputSchema.safeParse({
      ...validBase,
      endsAt: '2026-12-20T10:00:00.000Z',
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message.includes('90 päeva'))).toBe(true)
    }
  })
})

describe('anti-snipe bounds', () => {
  it('exposes the 1-30 minute bounds from Settings', () => {
    expect(ANTI_SNIPE_MIN_MINUTES).toBe(1)
    expect(ANTI_SNIPE_MAX_MINUTES).toBe(30)
  })

  it('requires minutes when anti-snipe is enabled', () => {
    const parsed = auctionInputSchema.safeParse({
      ...validBase,
      antiSnipeEnabled: true,
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects minutes outside 1-30', () => {
    const parsed = auctionInputSchema.safeParse({
      ...validBase,
      antiSnipeEnabled: true,
      antiSnipeMinutes: 45,
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts minutes inside 1-30', () => {
    const parsed = auctionInputSchema.safeParse({
      ...validBase,
      antiSnipeEnabled: true,
      antiSnipeMinutes: 13,
    })
    expect(parsed.success).toBe(true)
  })
})

describe('mechanics per auction type', () => {
  it('requires a bid step of at least 1 EUR on open lots', () => {
    const parsed = auctionInputSchema.safeParse({ ...validBase, bidStepEur: 0.5 })
    expect(parsed.success).toBe(false)
  })

  it('forbids a bid step on sealed lots', () => {
    const parsed = auctionInputSchema.safeParse({
      ...validBase,
      objectType: 'kinnistu',
      auctionType: 'sealed',
      bidStepEur: 10,
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path[0] === 'bidStepEur')).toBe(true)
    }
  })

  it('requires a starting price on non-quick lots', () => {
    const parsed = auctionInputSchema.safeParse({ ...validBase, minBidEur: undefined })
    expect(parsed.success).toBe(false)
  })
})

describe('write-only reserve conversion', () => {
  it('converts EUR fields to integer cents', () => {
    const parsed = auctionInputSchema.safeParse({
      ...validBase,
      reservePriceEur: 1234.56,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      const writeData = toAuctionWriteData(applyQuickAuctionDefaults(parsed.data))
      expect(writeData.minBidCents).toBe(300000)
      expect(writeData.bidStepCents).toBe(5000)
      expect(writeData.reservePriceCents).toBe(123456)
    }
  })

  it('omits the reserve column when the operator did not re-enter it', () => {
    const parsed = auctionInputSchema.safeParse(validBase)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      const writeData = toAuctionWriteData(applyQuickAuctionDefaults(parsed.data))
      expect(writeData.reservePriceCents).toBeUndefined()
    }
  })

  it('defaults a kiiroksjon starting price to 100 cents', () => {
    const parsed = auctionInputSchema.safeParse({
      ...validBase,
      isQuickAuction: true,
      reservePriceEur: 5000,
      minBidEur: undefined,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(toAuctionWriteData(applyQuickAuctionDefaults(parsed.data)).minBidCents).toBe(100)
    }
  })
})

describe('publish gates', () => {
  it('blocks on an invalid cadastre', () => {
    const gates = collectPublishGateFailures(gateSubject({ cadastres: ['12:34:567'] }))
    expect(gates.blocking.some((gate) => gate.field === 'cadastres')).toBe(true)
  })

  it('blocks a kiiroksjon without a reserve', () => {
    const gates = collectPublishGateFailures(gateSubject({ isQuickAuction: true }))
    expect(gates.blocking.some((gate) => gate.field === 'reservePrice')).toBe(true)
  })

  it('blocks when a gallery image lacks alt text', () => {
    const gates = collectPublishGateFailures(
      gateSubject({ media: [{ url: 'a.jpg', alt: '' }, { url: 'b.jpg', alt: 'Vaade' }] }),
    )
    expect(gates.blocking.some((gate) => gate.field === 'media[0].alt')).toBe(true)
  })

  it('does not block legacy lots without media rows', () => {
    const gates = collectPublishGateFailures(gateSubject())
    expect(gates.blocking).toHaveLength(0)
    expect(gates.warnings.some((gate) => gate.field === 'media')).toBe(true)
  })

  it('blocks an open property lot', () => {
    const gates = collectPublishGateFailures(gateSubject({ objectType: 'kinnistu', type: 'open' }))
    expect(gates.blocking.some((gate) => gate.field === 'auctionType')).toBe(true)
  })

  it('blocks a forest lot without a volume total', () => {
    const gates = collectPublishGateFailures(gateSubject({ packageRows: [{ area: 5 }] }))
    expect(gates.blocking.some((gate) => gate.field === 'volumeM3')).toBe(true)
  })
})

describe('slugifyTitle', () => {
  it('transliterates Estonian characters and collapses separators', () => {
    expect(slugifyTitle('Lepsi ja Õismäe raieõigus — 12,4 ha')).toBe('lepsi-ja-oismae-raieoigus-12-4-ha')
  })

  it('falls back to a generic slug for an empty result', () => {
    expect(slugifyTitle('***')).toBe('oksjon')
  })
})
