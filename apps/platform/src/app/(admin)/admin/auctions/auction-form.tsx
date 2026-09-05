import { AuctionWizard } from './_components/AuctionWizard'
import type {
  AuctionWizardInitial,
  AuctionWizardOptions,
  AuctionWizardState,
} from './_components/wizard-model'
import { mediaStateFrom, packageRowsStateFrom } from './_components/wizard-model'
import { loggingTypeCodes, speciesCodes } from './_lib/auction-schema'
import { createGuestPreviewToken } from '../../../(portal)/oksjon/esivaade/_lib/preview-token'
import { regenerateAliasEmailAction, publishAuctionAction } from '../../_actions/auctions'
import { requireAdminRepositories } from '../../_lib/admin'
import { can } from '../../_lib/permissions'
import { utcIsoToTallinnInputValue } from '../content/_components/scheduled-publish'

import { clampAntiSnipeMinutes } from '@/lib/bidding/anti-snipe'
import type { AuctionDoc, CoreRepositories } from '@/lib/data/repositories'
import { centsToEuros } from '@/lib/data/repositories/money'
import type { AuctionObjectType } from '@/lib/data/schema'

/**
 * Server entry for the seven-step lot editor wizard (task 2.4: steps 1-4).
 * Builds the client's sanitized initial state here so the stored reserve
 * price never crosses to the browser (design D5 write-only reserve): the
 * client receives only the boolean fact that a reserve exists.
 */

export interface AuctionFormOptions {
  counties: readonly { id: string; name: string }[]
  parishes: readonly { id: string; name: string; countyId: string }[]
  specialists: readonly { id: string; name: string }[]
  antiSnipeDefaultMinutes: number
  defaultFeePercent: number
}

export async function loadAuctionFormOptions(
  repositories: CoreRepositories,
): Promise<AuctionFormOptions> {
  const [countyResult, parishResult, specialistResult, settingsResult] = await Promise.all([
    repositories.find({ collection: 'counties', sort: 'name', pagination: false }),
    repositories.find({ collection: 'parishes', sort: 'name', pagination: false }),
    repositories.find({
      collection: 'specialists',
      where: { active: { equals: true } },
      sort: 'name',
      pagination: false,
    }),
    repositories.find({ collection: 'settings', limit: 1 }),
  ])

  const settings = settingsResult.docs[0]
  return {
    counties: countyResult.docs,
    parishes: parishResult.docs,
    specialists: specialistResult.docs,
    antiSnipeDefaultMinutes: clampAntiSnipeMinutes(settings?.antiSnipeDurationMinutes),
    defaultFeePercent: typeof settings?.feePercent === 'number' ? settings.feePercent : 3,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function recordString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

function recordBoolean(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true
}

function recordNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function recordNumberString(record: Record<string, unknown>, key: string): string {
  const value = recordNumber(record, key)
  return value === null ? '' : String(value)
}

/** Stored string arrays keep every string; unknown entries stay untouched. */
function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

/** Stored code arrays keep only values the schema still accepts. */
function knownCodes(value: unknown, allowed: readonly string[]): string[] {
  const set = new Set(allowed)
  return stringArray(value).filter((entry) => set.has(entry))
}

function euros(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  try {
    return String(centsToEuros(cents))
  } catch {
    return ''
  }
}

const speciesCodeList: readonly string[] = [...speciesCodes]
const loggingTypeCodeList: readonly string[] = [...loggingTypeCodes]

function emptyWizardState(options: AuctionFormOptions): AuctionWizardState {
  return {
    title: '',
    slug: '',
    objectType: 'raieoigus',
    auctionType: 'open',
    isQuickAuction: false,
    antiSnipeEnabled: false,
    antiSnipeMinutes: String(options.antiSnipeDefaultMinutes),
    startsAt: '',
    endsAt: '',
    minBidEur: '',
    bidStepEur: '',
    reserveEur: '',
    reserveEditing: false,
    feeOverridePercent: '',
    countyId: '',
    parishId: '',
    address: '',
    lat: '',
    lng: '',
    cadastres: [''],
    registryNumbers: [''],
    compartments: [],
    forestNotifications: [],
    species: [],
    loggingTypes: [],
    areaHa: '',
    volumeM3: '',
    loggingDeadline: '',
    removalDeadline: '',
    leaseDeadline: '',
    propertyCount: null,
    specialistId: '',
    descriptionPublic: '',
    descriptionSecondary: '',
    media: [],
    packageHeader: '',
    packageRows: [],
  }
}

function wizardStateFromAuction(
  auction: AuctionDoc,
  options: AuctionFormOptions,
): AuctionWizardState {
  const deadlines = asRecord(auction.deadlines)
  const coordinates = asRecord(auction.coordinates)
  const objectType: AuctionObjectType = auction.objectType

  return {
    title: auction.title,
    slug: auction.slug,
    objectType,
    auctionType: auction.type,
    isQuickAuction: auction.isQuickAuction,
    antiSnipeEnabled: recordBoolean(deadlines, 'antiSnipeEnabled'),
    antiSnipeMinutes:
      recordNumberString(deadlines, 'antiSnipeMinutes') !== ''
        ? recordNumberString(deadlines, 'antiSnipeMinutes')
        : String(options.antiSnipeDefaultMinutes),
    startsAt: utcIsoToTallinnInputValue(auction.startsAt),
    endsAt: utcIsoToTallinnInputValue(auction.endsAt),
    minBidEur: euros(auction.minBidCents),
    bidStepEur: euros(auction.bidStepCents),
    // Write-only reserve: never seeded from the stored value (design D5).
    reserveEur: '',
    reserveEditing: false,
    feeOverridePercent:
      typeof auction.feeOverridePercent === 'number' ? String(auction.feeOverridePercent) : '',
    countyId: auction.countyId ?? '',
    parishId: auction.parishId ?? '',
    address: auction.address ?? '',
    lat: recordNumberString(coordinates, 'lat'),
    lng: recordNumberString(coordinates, 'lng'),
    cadastres: stringArray(auction.cadastres),
    registryNumbers: stringArray(auction.registryNumbers),
    compartments: stringArray(auction.compartments),
    forestNotifications: stringArray(auction.notifications),
    species: knownCodes(auction.species, speciesCodeList),
    loggingTypes: knownCodes(auction.loggingTypes, loggingTypeCodeList),
    areaHa: recordNumberString(deadlines, 'areaHa'),
    volumeM3: recordNumberString(deadlines, 'volumeM3'),
    loggingDeadline: recordString(deadlines, 'loggingDeadline'),
    removalDeadline: recordString(deadlines, 'removalDeadline'),
    leaseDeadline: recordString(deadlines, 'leaseDeadline'),
    propertyCount: recordNumber(deadlines, 'propertyCount'),
    specialistId: auction.specialistId ?? '',
    descriptionPublic: auction.descriptionPublic ?? '',
    descriptionSecondary: auction.descriptionSecondary ?? '',
    media: mediaStateFrom(auction.media),
    packageHeader: auction.packageHeader ?? '',
    packageRows: packageRowsStateFrom(auction.packageRows),
  }
}

export async function AuctionForm({
  action,
  auction,
  options,
  submitLabel,
  cancelHref,
}: {
  action: (formData: FormData) => Promise<void>
  auction?: AuctionDoc | null
  options: AuctionFormOptions
  submitLabel: string
  cancelHref: string
}) {
  const { session } = await requireAdminRepositories()
  const wizardOptions: AuctionWizardOptions = {
    ...options,
    canFeeOverride: can(session.role, 'auctions:fee-override'),
    canReassignSpecialist: can(session.role, 'auctions:reassign-specialist'),
    regenerateAliasEmail: regenerateAliasEmailAction,
    publishAuction: publishAuctionAction,
  }

  const initial: AuctionWizardInitial =
    auction === null || auction === undefined
      ? {
          auctionId: null,
          mechanicsLocked: false,
          hasReserve: false,
          aliasEmail: null,
          guestPreviewHref: null,
          state: emptyWizardState(options),
        }
      : {
          auctionId: auction.id,
          mechanicsLocked: auction.status === 'active' || auction.status === 'scheduled',
          hasReserve: typeof auction.reservePriceCents === 'number',
          aliasEmail: auction.aliasEmail ?? null,
          // Signed 24h draft token; the portal route verifies it without
          // storage (no preview-token column exists in the auctions schema).
          guestPreviewHref: `/oksjon/esivaade/${await createGuestPreviewToken(auction.id)}`,
          state: wizardStateFromAuction(auction, options),
        }

  return (
    <AuctionWizard
      action={action}
      submitLabel={submitLabel}
      cancelHref={cancelHref}
      options={wizardOptions}
      initial={initial}
    />
  )
}
