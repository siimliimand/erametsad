import { describe, expect, it } from 'vitest'

import {
  buildAuctionPayload,
  mediaStateFrom,
  packageRowSums,
  packageRowsStateFrom,
  parsePackageRowsCsv,
  quickAuctionPatch,
  reviewIssues,
  sanitizeRichText,
  stepForField,
  validateAuctionDraft,
  validateWizardForSubmit,
  type AuctionWizardInitial,
  type AuctionWizardState,
} from './wizard-model'
import { auctionInputSchema } from '../_lib/auction-schema'

const options = { canFeeOverride: true, canReassignSpecialist: true }

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
  specialistId: 'spec-1',
  descriptionPublic: 'Avalik info',
  descriptionSecondary: 'Täiendav info',
  media: [{ url: 'https://cdn.example/hero.jpg', alt: 'Mets' }],
  packageHeader: '',
  packageRows: [],
}

const createInitial: AuctionWizardInitial = {
  auctionId: null,
  mechanicsLocked: false,
  hasReserve: false,
  aliasEmail: null,
  guestPreviewHref: null,
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

  it('carries the step 5 content fields through sanitisation', () => {
    const payload = buildAuctionPayload(
      createInitial,
      {
        ...baseState,
        descriptionPublic: 'Rida 1\r\nRida 2\u0000kustunud',
        descriptionSecondary: 'Tühi',
        media: [
          { url: 'https://cdn.example/hero.jpg', alt: 'Mets' },
          { url: 'https://cdn.example/g.jpg', alt: '', focalX: 0.5, focalY: 0.25 },
        ],
      },
      options,
    )
    expect(payload.descriptionPublic).toBe('Rida 1\nRida 2kustunud')
    expect(payload.descriptionSecondary).toBe('Tühi')
    expect(payload.media).toEqual([
      { url: 'https://cdn.example/hero.jpg', alt: 'Mets' },
      { url: 'https://cdn.example/g.jpg', alt: '', focalX: 0.5, focalY: 0.25 },
    ])
  })

  it('sends the specialist only when the operator may reassign', () => {
    const withPermission = buildAuctionPayload(createInitial, baseState, options)
    expect(withPermission.specialistId).toBe('spec-1')
    const withoutPermission = buildAuctionPayload(createInitial, baseState, {
      ...options,
      canReassignSpecialist: false,
    })
    expect(withoutPermission.specialistId).toBeUndefined()
  })

  it('caps sanitised copy at the schema limit and normalises line endings', () => {
    expect(sanitizeRichText('a'.repeat(20001)).length).toBe(20000)
    expect(sanitizeRichText('siia\rtuleb\nreavahetus')).toBe('siia\ntuleb\nreavahetus')
    expect(sanitizeRichText('rida 1\r\nrida 2')).toBe('rida 1\nrida 2')
  })

  it('drops control characters from sanitised copy', () => {
    expect(sanitizeRichText('ok\u0000bad')).toBe('okbad')
  })

  it('maps stored media and package rows into editable state', () => {
    const media = mediaStateFrom([
      { url: 'https://cdn.example/a.jpg', alt: 'A', focalX: 0.1 },
      { url: '', alt: 'broken' },
      'junk',
    ])
    expect(media).toEqual([{ url: 'https://cdn.example/a.jpg', alt: 'A', focalX: 0.1 }])

    const rows = packageRowsStateFrom([
      { cadastre: '34801:001:0217', registryNumber: 150934, areaHa: 5.5, minBidEur: 1000 },
    ])
    expect(rows).toEqual([
      { cadastre: '34801:001:0217', registryNumber: '150934', county: '', areaHa: '5.5', minBidEur: '1000' },
    ])
  })

  it('parses pasted CSV rows and sums their numbers', () => {
    const rows = parsePackageRowsCsv(
      '34801:001:0217;150934;Harjumaa;5,5;1000\n34801:001:0218;150935;Harjumaa;6,9;2000\n',
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ cadastre: '34801:001:0217', areaHa: '5,5' })
    expect(packageRowSums(rows)).toEqual({ areaHa: 12.4, minBidEur: 3000 })
  })

  it('includes package fields only for package lots', () => {
    const packageState: AuctionWizardState = {
      ...baseState,
      objectType: 'pakett',
      auctionType: 'sealed',
      bidStepEur: '',
      propertyCount: 2,
      packageHeader: 'Kaks katastrit',
      packageRows: [
        { cadastre: '34801:001:0217', registryNumber: '150934', county: 'Harjumaa', areaHa: '5,5', minBidEur: '1500' },
        { cadastre: '34801:001:0218', registryNumber: '', county: '', areaHa: '6,9', minBidEur: '' },
      ],
      volumeM3: '',
    }
    const payload = buildAuctionPayload(createInitial, packageState, options)
    expect(payload.packageHeader).toBe('Kaks katastrit')
    expect(payload.packageRows).toEqual([
      { cadastre: '34801:001:0217', registryNumber: '150934', county: 'Harjumaa', areaHa: 5.5, minBidEur: 1500 },
      { cadastre: '34801:001:0218', areaHa: 6.9 },
    ])
    expect(payload.propertyCount).toBe(2)
    const parsed = auctionInputSchema.safeParse(payload)
    expect(parsed.success).toBe(true)

    const plainPayload = buildAuctionPayload(createInitial, baseState, options)
    expect(plainPayload.packageHeader).toBeUndefined()
    expect(plainPayload.packageRows).toBeUndefined()
  })

  it('lists a missing alt text as a blocking Sisu issue', () => {
    const issues = reviewIssues(
      createInitial,
      { ...baseState, media: [{ url: 'https://cdn.example/hero.jpg', alt: '' }] },
      options,
    )
    const altIssue = issues.find((issue) => issue.field.startsWith('media['))
    expect(altIssue).toMatchObject({ step: 5, severity: 'error' })
    const submitErrors = validateWizardForSubmit(
      createInitial,
      { ...baseState, media: [{ url: 'https://cdn.example/hero.jpg', alt: '' }] },
      options,
    )
    expect(Object.keys(submitErrors).some((key) => key.startsWith('media['))).toBe(true)
  })

  it('warns when the package row count disagrees with propertyCount', () => {
    const packageState: AuctionWizardState = {
      ...baseState,
      objectType: 'pakett',
      auctionType: 'sealed',
      bidStepEur: '',
      propertyCount: 3,
      packageHeader: '',
      packageRows: [
        { cadastre: '34801:001:0217', registryNumber: '', county: '', areaHa: '5', minBidEur: '' },
      ],
      volumeM3: '',
    }
    const issues = reviewIssues(createInitial, packageState, options)
    const blockages = issues.filter((issue) => issue.severity === 'error')
    expect(
      blockages.filter((issue) => stepForField(issue.field) === 6),
    ).toEqual([])
  })

  it('keeps a masked stored reserve out of the gate failures', () => {
    const issues = reviewIssues(
      { ...createInitial, hasReserve: true },
      { ...baseState, isQuickAuction: true, auctionType: 'open' },
      options,
    )
    expect(issues.some((issue) => issue.field === 'reservePrice')).toBe(false)
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
    expect(stepForField('reservePrice')).toBe(4)
    expect(stepForField('title')).toBe(5)
    expect(stepForField('descriptionPublic')).toBe(5)
    expect(stepForField('specialistId')).toBe(5)
    expect(stepForField('media[1].alt')).toBe(5)
    expect(stepForField('media.0.alt')).toBe(5)
    expect(stepForField('propertyCount')).toBe(6)
    expect(stepForField('packageRows.0.cadastre')).toBe(6)
  })
})
