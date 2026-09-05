import { describe, expect, it } from 'vitest'

import {
  buildAuctionPayload,
  quickAuctionPatch,
  stepForField,
  validateAuctionDraft,
  type AuctionWizardInitial,
  type AuctionWizardState,
} from './wizard-model'
import { auctionInputSchema } from '../_lib/auction-schema'

const options = { canFeeOverride: true }

const baseState: AuctionWizardState = {
  title: 'Harjumaa raieõigus',
  slug: '',
  objectType: 'raieoigus',
  auctionType: 'open',
  isQuickAuction: false,
  antiSnipeEnabled: true,
  antiSnipeMinutes: '5',
  startsAt: '2026-12-01T12:00',
  endsAt: '2026-12-10T12:00',
  minBidEur: '3000',
  bidStepEur: '50',
  reserveEur: '',
  reserveEditing: false,
  feeOverridePercent: '',
  countyId: 'c1',
  parishId: 'p1',
  address: 'Metsa tänav 1',
  lat: '58.6342',
  lng: '25.0',
  cadastres: ['34801:001:0217'],
  registryNumbers: ['150934'],
  compartments: ['4 VR'],
  forestNotifications: ['50001182112'],
  species: ['MA', 'KU'],
  loggingTypes: ['VR', 'HR'],
  areaHa: '12.4',
  volumeM3: '980',
  loggingDeadline: '2027-12-31',
  removalDeadline: '2028-03-31',
  leaseDeadline: '',
  propertyCount: null,
}

const createInitial: AuctionWizardInitial = {
  auctionId: null,
  mechanicsLocked: false,
  hasReserve: false,
  state: baseState,
}

describe('buildAuctionPayload', () => {
  it('produces a payload the shared schema accepts', () => {
    const payload = buildAuctionPayload(createInitial, baseState, options)
    const parsed = auctionInputSchema.safeParse(payload)
    expect(parsed.success).toBe(true)
  })

  it('converts Tallinn wall times to UTC ISO', () => {
    const payload = buildAuctionPayload(createInitial, baseState, options)
    expect(payload.startsAt).toBe('2026-12-01T10:00:00.000Z')
    expect(payload.endsAt).toBe('2026-12-10T10:00:00.000Z')
  })

  it('keeps mechanics off the payload of a locked lot but keeps area', () => {
    const lockedInitial: AuctionWizardInitial = { ...createInitial, mechanicsLocked: true }
    const payload = buildAuctionPayload(lockedInitial, baseState, options)
    expect(payload.startsAt).toBeUndefined()
    expect(payload.endsAt).toBeUndefined()
    expect(payload.minBidEur).toBeUndefined()
    expect(payload.bidStepEur).toBeUndefined()
    expect(payload.areaHa).toBe(12.4)
    expect(payload.deadlines).toBeDefined()
  })

  it('sends the reserve only when the operator entered it', () => {
    const payload = buildAuctionPayload(createInitial, baseState, options)
    expect(payload.reservePriceEur).toBeUndefined()
    const withReserve = buildAuctionPayload(
      createInitial,
      { ...baseState, reserveEur: '5000' },
      options,
    )
    expect(withReserve.reservePriceEur).toBe(5000)
  })

  it('drops invalid coordinates instead of sending them', () => {
    const payload = buildAuctionPayload(
      createInitial,
      { ...baseState, lat: '999' },
      options,
    )
    expect(payload.coordinates).toBeUndefined()
  })

  it('passes arrays through with trimming', () => {
    const payload = buildAuctionPayload(
      createInitial,
      { ...baseState, cadastres: [' 34801:001:0217 ', ''] },
      options,
    )
    expect(payload.cadastres).toEqual(['34801:001:0217'])
  })
})

describe('validateAuctionDraft', () => {
  it('returns no errors for the valid base draft', () => {
    expect(validateAuctionDraft(createInitial, baseState, options)).toEqual({})
  })

  it('maps a sealed-only lot to the auctionType field', () => {
    const errors = validateAuctionDraft(
      createInitial,
      { ...baseState, objectType: 'kinnistu' },
      options,
    )
    expect(errors.auctionType).toContain('pimepakkumisega')
  })

  it('demands a reserve for a kiiroksjon without one', () => {
    const errors = validateAuctionDraft(
      createInitial,
      { ...baseState, isQuickAuction: true, auctionType: 'open' },
      options,
    )
    expect(errors.reservePriceEur).toContain('piirhind')
  })

  it('accepts a kiiroksjon whose reserve exists but is masked', () => {
    const errors = validateAuctionDraft(
      { ...createInitial, hasReserve: true },
      { ...baseState, isQuickAuction: true, auctionType: 'open' },
      options,
    )
    expect(errors.reservePriceEur).toBeUndefined()
  })

  it('requires anti-snipe minutes when the toggle is on', () => {
    const errors = validateAuctionDraft(
      createInitial,
      { ...baseState, antiSnipeMinutes: '' },
      options,
    )
    expect(errors.antiSnipeMinutes).toBeDefined()
  })
})

describe('quickAuctionPatch', () => {
  it('forces open bidding and a €1 starting price', () => {
    const patch = quickAuctionPatch(baseState, true, 7)
    expect(patch.isQuickAuction).toBe(true)
    expect(patch.auctionType).toBe('open')
    expect(patch.minBidEur).toBeUndefined()
    const withoutMinBid = quickAuctionPatch(
      { ...baseState, minBidEur: '' },
      true,
      7,
    )
    expect(withoutMinBid.minBidEur).toBe('1')
  })

  it('suggests a 48 hour window when the current one is out of bounds', () => {
    const patch = quickAuctionPatch(baseState, true, 7)
    // 2026-12-01T12:00 Tallinn (UTC+2) plus 48 real hours is 2026-12-03T12:00 Tallinn.
    expect(patch.endsAt).toBe('2026-12-03T12:00')
  })

  it('prefills the settings anti-snipe default when empty', () => {
    const patch = quickAuctionPatch(
      { ...baseState, antiSnipeMinutes: '' },
      true,
      7,
    )
    expect(patch.antiSnipeMinutes).toBe('7')
  })
})

describe('stepForField', () => {
  it('maps fields to their wizard steps', () => {
    expect(stepForField('objectType')).toBe(1)
    expect(stepForField('countyId')).toBe(2)
    expect(stepForField('cadastres')).toBe(3)
    expect(stepForField('reservePriceEur')).toBe(4)
    expect(stepForField('descriptionPublic')).toBeNull()
  })
})
