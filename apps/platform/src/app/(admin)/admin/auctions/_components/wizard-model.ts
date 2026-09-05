import {
  tallinnWallTimeToUtcIso,
  utcIsoToTallinnInputValue,
} from '../../content/_components/scheduled-publish'
import {
  auctionInputSchema,
  loggingTypeCodes,
  speciesCodes,
} from '../_lib/auction-schema'

import type { AuctionObjectType } from '@/lib/data/schema'

/**
 * Client-side wizard model for the seven-step lot editor (docs/design/admin/03
 * steps 1-4; task 2.4). Steps collect into one state; the form posts the full
 * state as the JSON `payload` field the create/update actions already accept.
 * The stored reserve price never enters this module: the initial state carries
 * only the boolean fact `hasReserve` (design D5 write-only reserve).
 */

export type AuctionTypeValue = 'open' | 'sealed'

export interface AuctionWizardState {
  title: string
  slug: string
  objectType: AuctionObjectType
  auctionType: AuctionTypeValue
  isQuickAuction: boolean
  antiSnipeEnabled: boolean
  antiSnipeMinutes: string
  startsAt: string
  endsAt: string
  minBidEur: string
  bidStepEur: string
  /** Only set when the operator enters a value; never seeded from storage. */
  reserveEur: string
  /** UI flag for the masked reserve re-entry flow; never serialized. */
  reserveEditing: boolean
  feeOverridePercent: string
  countyId: string
  parishId: string
  address: string
  lat: string
  lng: string
  cadastres: string[]
  registryNumbers: string[]
  compartments: string[]
  forestNotifications: string[]
  species: string[]
  loggingTypes: string[]
  areaHa: string
  volumeM3: string
  loggingDeadline: string
  removalDeadline: string
  leaseDeadline: string
  /** Pakett passthrough so a wizard save never wipes the stored value. */
  propertyCount: number | null
}

export interface AuctionWizardOptions {
  counties: readonly { id: string; name: string }[]
  parishes: readonly { id: string; name: string; countyId: string }[]
  specialists: readonly { id: string; name: string }[]
  antiSnipeDefaultMinutes: number
  defaultFeePercent: number
  canFeeOverride: boolean
}

export interface AuctionWizardInitial {
  auctionId: string | null
  /** Active or scheduled lots lock mechanics (docs 03 interactions). */
  mechanicsLocked: boolean
  /** Boolean fact only — the stored reserve value never crosses to the client. */
  hasReserve: boolean
  state: AuctionWizardState
}

export interface WizardStepContext {
  state: AuctionWizardState
  patch: (patch: Partial<AuctionWizardState>) => void
  errors: Readonly<Record<string, string>>
  initial: AuctionWizardInitial
  options: AuctionWizardOptions
}

export const FORCED_SEALED_TYPES: readonly AuctionObjectType[] = ['kinnistu', 'pakett']

export const FORCED_SEALED_TOOLTIP = 'Kinnistu ja pakett müüakse ainult pimepakkumisega.'

export function isForcedSealed(objectType: AuctionObjectType): boolean {
  return FORCED_SEALED_TYPES.includes(objectType)
}

/** Parses a decimal input (comma or dot) into a finite number. */
export function parseDecimal(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

export function parseInteger(value: string): number | undefined {
  const parsed = parseDecimal(value)
  if (parsed === undefined || !Number.isInteger(parsed)) return undefined
  return parsed
}

function setIfNumber(payload: Record<string, unknown>, key: string, value: string): void {
  const parsed = parseDecimal(value)
  if (parsed !== undefined) payload[key] = parsed
}

/** Tallinn wall time plus hours, back to a datetime-local wall value. */
function addHoursWall(wall: string, hours: number): string | null {
  const iso = tallinnWallTimeToUtcIso(wall)
  if (iso === null) return null
  return utcIsoToTallinnInputValue(
    new Date(Date.parse(iso) + hours * 60 * 60 * 1000).toISOString(),
  )
}

export function wallDurationMs(startWall: string, endWall: string): number | null {
  const start = tallinnWallTimeToUtcIso(startWall)
  const end = tallinnWallTimeToUtcIso(endWall)
  if (start === null || end === null) return null
  return Date.parse(end) - Date.parse(start)
}

/**
 * Side effects of enabling the kiiroksjon toggle (docs 03 step 1): open
 * bidding, €1 starting price when empty, a suggested 48-hour window and the
 * Settings anti-snipe default.
 */
export function quickAuctionPatch(
  state: AuctionWizardState,
  enable: boolean,
  antiSnipeDefaultMinutes: number,
): Partial<AuctionWizardState> {
  if (!enable) return { isQuickAuction: false }
  const patch: Partial<AuctionWizardState> = {
    isQuickAuction: true,
    auctionType: 'open',
    reserveEditing: false,
    reserveEur: '',
  }
  if (parseDecimal(state.minBidEur) === undefined) patch.minBidEur = '1'
  if (state.startsAt !== '') {
    const duration = wallDurationMs(state.startsAt, state.endsAt)
    const inWindow = duration !== null && duration >= 24 * 60 * 60 * 1000 && duration <= 72 * 60 * 60 * 1000
    if (state.endsAt === '' || !inWindow) {
      const suggested = addHoursWall(state.startsAt, 48)
      if (suggested !== null) patch.endsAt = suggested
    }
  }
  if (state.antiSnipeMinutes.trim() === '') {
    patch.antiSnipeMinutes = String(antiSnipeDefaultMinutes)
  }
  return patch
}

/** Field -> step number (1-4) for the step badges and the jump-on-error. */
const FIELD_STEP: Record<string, number> = {
  objectType: 1,
  auctionType: 1,
  isQuickAuction: 1,
  antiSnipeEnabled: 1,
  antiSnipeMinutes: 1,
  startsAt: 1,
  endsAt: 1,
  countyId: 2,
  parishId: 2,
  address: 2,
  coordinates: 2,
  cadastres: 3,
  registryNumbers: 3,
  species: 3,
  loggingTypes: 3,
  compartments: 3,
  forestNotifications: 3,
  deadlines: 3,
  areaHa: 3,
  volumeM3: 3,
  minBidEur: 4,
  bidStepEur: 4,
  reservePriceEur: 4,
  feeOverridePercent: 4,
}

export function stepForField(field: string): number | null {
  return FIELD_STEP[field] ?? null
}

/**
 * The full wizard payload in the schema's input keys. Omitted keys never
 * overwrite stored values (the actions' partial-update semantics), so steps
 * 5-7 fields simply stay absent until task 2.5 owns them.
 */
export function buildAuctionPayload(
  initial: AuctionWizardInitial,
  state: AuctionWizardState,
  options: Pick<AuctionWizardOptions, 'canFeeOverride'>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: state.title.trim(),
    objectType: state.objectType,
    auctionType: state.auctionType,
    isQuickAuction: state.isQuickAuction,
    antiSnipeEnabled: state.antiSnipeEnabled,
  }
  if (initial.auctionId === null && state.slug.trim() !== '') {
    payload.slug = state.slug.trim()
  }

  if (!initial.mechanicsLocked) {
    const startsAt = tallinnWallTimeToUtcIso(state.startsAt)
    if (startsAt !== null) payload.startsAt = startsAt
    const endsAt = tallinnWallTimeToUtcIso(state.endsAt)
    if (endsAt !== null) payload.endsAt = endsAt
    setIfNumber(payload, 'minBidEur', state.minBidEur)
    setIfNumber(payload, 'bidStepEur', state.bidStepEur)
  }
  // Area/volume are not mechanics: they travel even on locked lots so the
  // deadlines JSON they merge into is never wiped by a partial update.
  setIfNumber(payload, 'areaHa', state.areaHa)
  setIfNumber(payload, 'volumeM3', state.volumeM3)

  if (state.antiSnipeEnabled) {
    const minutes = parseInteger(state.antiSnipeMinutes)
    if (minutes !== undefined) payload.antiSnipeMinutes = minutes
  }

  if (state.reserveEur.trim() !== '') {
    const reserve = parseDecimal(state.reserveEur)
    if (reserve !== undefined) payload.reservePriceEur = reserve
  }

  if (options.canFeeOverride) {
    const fee = parseInteger(state.feeOverridePercent)
    if (fee !== undefined && fee >= 0 && fee <= 100) {
      payload.feeOverridePercent = fee
    }
  }

  if (state.countyId !== '') payload.countyId = state.countyId
  if (state.parishId !== '') payload.parishId = state.parishId
  if (state.address.trim() !== '') payload.address = state.address.trim()

  const lat = parseDecimal(state.lat)
  const lng = parseDecimal(state.lng)
  if (
    lat !== undefined &&
    lng !== undefined &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  ) {
    payload.coordinates = { lat, lng }
  }

  payload.cadastres = state.cadastres.map((value) => value.trim()).filter((value) => value !== '')
  payload.registryNumbers = state.registryNumbers
    .map((value) => value.trim())
    .filter((value) => value !== '')
  payload.compartments = state.compartments
    .map((value) => value.trim())
    .filter((value) => value !== '')
  payload.forestNotifications = state.forestNotifications
    .map((value) => value.trim())
    .filter((value) => value !== '')
  payload.species = [...state.species]
  payload.loggingTypes = [...state.loggingTypes]

  const deadlines: Record<string, unknown> = { antiSnipeEnabled: state.antiSnipeEnabled }
  if (state.antiSnipeEnabled) {
    const minutes = parseInteger(state.antiSnipeMinutes)
    if (minutes !== undefined) deadlines.antiSnipeMinutes = minutes
  }
  if (state.loggingDeadline !== '') deadlines.loggingDeadline = state.loggingDeadline
  if (state.removalDeadline !== '') deadlines.removalDeadline = state.removalDeadline
  if (state.leaseDeadline !== '') deadlines.leaseDeadline = state.leaseDeadline
  if (state.propertyCount !== null) payload.propertyCount = state.propertyCount
  payload.deadlines = deadlines

  return payload
}

/**
 * Client-side mirror of the action's schema gate, so inline errors match what
 * the server will enforce. A stored-but-masked reserve satisfies the
 * kiiroksjon reserve rule: the substitute value keeps the schema happy and its
 * reserve issues are dropped because the operator cannot see the stored value
 * to re-enter it without choosing "Muuda" (design D5).
 */
export function validateAuctionDraft(
  initial: AuctionWizardInitial,
  state: AuctionWizardState,
  options: Pick<AuctionWizardOptions, 'canFeeOverride'>,
): Record<string, string> {
  const payload = buildAuctionPayload(initial, state, options)
  const reserveMaskedButStored =
    initial.hasReserve && state.reserveEur.trim() === '' && state.isQuickAuction
  if (reserveMaskedButStored) payload.reservePriceEur = 1

  const parsed = auctionInputSchema.safeParse(payload)
  if (parsed.success) return {}

  const errors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    if (reserveMaskedButStored && issue.path[0] === 'reservePriceEur') continue
    const key = issue.path.map(String).join('.')
    errors[key] ??= issue.message
  }
  return errors
}

export const SPECIES_OPTIONS: readonly { value: string; label: string }[] = speciesCodes.map(
  (code) => ({ value: code, label: code }),
)

export const LOGGING_TYPE_OPTIONS: readonly { value: string; label: string }[] =
  loggingTypeCodes.map((code) => ({ value: code, label: code }))
