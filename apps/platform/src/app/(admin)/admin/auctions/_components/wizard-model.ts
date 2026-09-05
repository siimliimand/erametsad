import {
  tallinnWallTimeToUtcIso,
  utcIsoToTallinnInputValue,
} from '../../content/_components/scheduled-publish'
import {
  auctionInputSchema,
  collectPublishGateFailures,
  loggingTypeCodes,
  speciesCodes,
} from '../_lib/auction-schema'
import type { AuctionGateSubject } from '../_lib/auction-schema'

import type { AuctionObjectType } from '@/lib/data/schema'

/**
 * Client-side wizard model for the seven-step lot editor (docs/design/admin/03;
 * task 2.4 steps 1-4, task 2.5 steps 5-7). Steps collect into one state; the
 * form posts the full state as the JSON `payload` field the create/update
 * actions already accept. The stored reserve price never enters this module:
 * the initial state carries only the boolean fact `hasReserve` (design D5
 * write-only reserve).
 */

export type AuctionTypeValue = 'open' | 'sealed'

/** Image row the editor owns; uploads and focal points land in task 2.6. */
export interface AuctionMediaItemState {
  url: string
  alt: string
  focalX?: number
  focalY?: number
}

/** Package table row kept as raw input strings until payload build. */
export interface PackageRowState {
  cadastre: string
  registryNumber: string
  county: string
  areaHa: string
  minBidEur: string
}

export function emptyPackageRow(): PackageRowState {
  return { cadastre: '', registryNumber: '', county: '', areaHa: '', minBidEur: '' }
}

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
  specialistId: string
  descriptionPublic: string
  descriptionSecondary: string
  media: AuctionMediaItemState[]
  packageHeader: string
  packageRows: PackageRowState[]
}

export interface AuctionWizardOptions {
  counties: readonly { id: string; name: string }[]
  parishes: readonly { id: string; name: string; countyId: string }[]
  specialists: readonly { id: string; name: string }[]
  antiSnipeDefaultMinutes: number
  defaultFeePercent: number
  canFeeOverride: boolean
  canReassignSpecialist: boolean
  /** Server actions wired by the server form; absent in unit tests. */
  regenerateAliasEmail?: (formData: FormData) => Promise<void>
  publishAuction?: (formData: FormData) => Promise<void>
}

export interface AuctionWizardInitial {
  auctionId: string | null
  /** Active or scheduled lots lock mechanics (docs 03 interactions). */
  mechanicsLocked: boolean
  /** Boolean fact only — the stored reserve value never crosses to the client. */
  hasReserve: boolean
  /** Stored inbound alias address, shown read-only in Sisu; null until saved. */
  aliasEmail: string | null
  /** Signed portal draft-preview URL; null until the lot exists. */
  guestPreviewHref: string | null
  state: AuctionWizardState
}

export interface WizardStepContext {
  state: AuctionWizardState
  patch: (patch: Partial<AuctionWizardState>) => void
  errors: Readonly<Record<string, string>>
  initial: AuctionWizardInitial
  options: AuctionWizardOptions
  /** Jumps by canonical step number (1-7), skipping a hidden Pakett step. */
  goToStep: (canonicalStep: number) => void
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

/** Field -> canonical step number (1-7) for the step badges and the jump-on-error. */
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
  minBid: 4,
  minBidEur: 4,
  bidStepEur: 4,
  reservePrice: 4,
  reservePriceEur: 4,
  feeOverridePercent: 4,
  title: 5,
  slug: 5,
  specialistId: 5,
  aliasEmail: 5,
  descriptionPublic: 5,
  descriptionSecondary: 5,
  media: 5,
  propertyCount: 6,
  packageHeader: 6,
  packageRows: 6,
}

export function stepForField(field: string): number | null {
  const exact = FIELD_STEP[field]
  if (exact !== undefined) return exact
  // Paths from arrays arrive as `media.0.alt` (zod) or `media[1].alt` (gates);
  // the leading collection name owns the step.
  const head = field.split(/[.[]/, 1)[0] ?? field
  return FIELD_STEP[head] ?? null
}

/**
 * The full wizard payload in the schema's input keys. Omitted keys never
 * overwrite stored values (the actions' partial-update semantics): the
 * Pakett fields stay absent for non-package lots and `files` stays absent
 * everywhere until the media step (task 2.6) owns them.
 */
export function buildAuctionPayload(
  initial: AuctionWizardInitial,
  state: AuctionWizardState,
  options: Pick<AuctionWizardOptions, 'canFeeOverride' | 'canReassignSpecialist'>,
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

  // Step 5 (Sisu): specialist, alias-independent copy and the media list.
  // Descriptions always travel (sanitised) so an emptied field clears the
  // stored value; the schema caps them at 20000 characters.
  if (options.canReassignSpecialist && state.specialistId.trim() !== '') {
    payload.specialistId = state.specialistId.trim()
  }
  payload.descriptionPublic = sanitizeRichText(state.descriptionPublic)
  payload.descriptionSecondary = sanitizeRichText(state.descriptionSecondary)
  payload.media = state.media.map((item) => ({
    url: item.url,
    alt: item.alt,
    ...(item.focalX !== undefined ? { focalX: item.focalX } : {}),
    ...(item.focalY !== undefined ? { focalY: item.focalY } : {}),
  }))

  // Step 6 (Pakett): package fields travel only for package lots, so a
  // non-package save never wipes stored rows.
  if (state.objectType === 'pakett') {
    payload.packageHeader = sanitizeRichText(state.packageHeader)
    payload.packageRows = packageRowsPayload(state.packageRows)
  }

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
  options: Pick<AuctionWizardOptions, 'canFeeOverride' | 'canReassignSpecialist'>,
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

// ── Step 5-7 model (task 2.5) ───────────────────────────────────────────────

/** Schema cap shared with `auctionInputSchema`'s description fields. */
export const RICH_TEXT_MAX_LENGTH = 20000

/**
 * Plain-text sanitisation for the Sisu/Pakett copy fields. There is no
 * rich-text editor in the repo yet, so the two copy fields submit plain
 * text through an allow-list pass: newlines and tabs stay, other control
 * characters drop, length caps at the schema limit. React escapes the text
 * again on every render, so no stored value can carry markup through.
 */
export function sanitizeRichText(value: string): string {
  const normalized = value.replace(/\r\n?/g, '\n')
  let out = ''
  for (const char of normalized) {
    if (char === '\n' || char === '\t' || (char.codePointAt(0) ?? 0) >= 32) {
      out += char
    }
  }
  return out.slice(0, RICH_TEXT_MAX_LENGTH)
}

/** Stored media JSON -> editable rows; rows without a URL are dropped. */
export function mediaStateFrom(value: unknown): AuctionMediaItemState[] {
  if (!Array.isArray(value)) return []
  const items: AuctionMediaItemState[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    if (typeof record.url !== 'string' || record.url.trim() === '') continue
    items.push({
      url: record.url,
      alt: typeof record.alt === 'string' ? record.alt : '',
      ...(typeof record.focalX === 'number' ? { focalX: record.focalX } : {}),
      ...(typeof record.focalY === 'number' ? { focalY: record.focalY } : {}),
    })
  }
  return items
}

/** Stored packageRows JSON -> editable rows; numbers become input strings. */
export function packageRowsStateFrom(value: unknown): PackageRowState[] {
  if (!Array.isArray(value)) return []
  const rows: PackageRowState[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const numberString = (key: string): string => {
      const raw = record[key]
      return typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : ''
    }
    const cadastre = typeof record.cadastre === 'string' ? record.cadastre : ''
    const registryNumber = typeof record.registryNumber === 'string' ? record.registryNumber : numberString('registryNumber')
    const county = typeof record.county === 'string' ? record.county : ''
    const areaHa = numberString('areaHa')
    const minBidEur = numberString('minBidEur')
    if (
      cadastre.trim() === '' &&
      registryNumber.trim() === '' &&
      county.trim() === '' &&
      areaHa.trim() === '' &&
      minBidEur.trim() === ''
    ) {
      continue
    }
    rows.push({ cadastre, registryNumber, county, areaHa, minBidEur })
  }
  return rows
}

function isRowEmpty(row: PackageRowState): boolean {
  return (
    row.cadastre.trim() === '' &&
    row.registryNumber.trim() === '' &&
    row.county.trim() === '' &&
    row.areaHa.trim() === '' &&
    row.minBidEur.trim() === ''
  )
}

function packageRowsPayload(rows: PackageRowState[]): Record<string, unknown>[] {
  return rows
    .filter((row) => !isRowEmpty(row))
    .map((row) => {
      const item: Record<string, unknown> = { cadastre: row.cadastre.trim() }
      const registry = row.registryNumber.trim()
      if (registry !== '') item.registryNumber = registry
      const county = row.county.trim()
      if (county !== '') item.county = county
      const area = parseDecimal(row.areaHa)
      if (area !== undefined) item.areaHa = area
      const minBid = parseDecimal(row.minBidEur)
      if (minBid !== undefined) item.minBidEur = minBid
      return item
    })
}

/**
 * "Kleebi tabel" parser (docs 03 step 6). Cells split on tab or semicolon —
 * the Estonian spreadsheet convention that keeps decimal commas intact; a
 * plain comma-separated line falls back only when no other separator exists.
 */
export function parsePackageRowsCsv(text: string): PackageRowState[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      let cells = line.split(/[\t;]+/).map((cell) => cell.trim())
      if (cells.length === 1) {
        const first = cells[0] ?? ''
        cells = first.split(/,+/).map((cell) => cell.trim())
      }
      return {
        cadastre: cells[0] ?? '',
        registryNumber: cells[1] ?? '',
        county: cells[2] ?? '',
        areaHa: cells[3] ?? '',
        minBidEur: cells[4] ?? '',
      }
    })
    .filter((row) => !isRowEmpty(row))
}

/** Column auto-sums for the package table footer. */
export function packageRowSums(rows: PackageRowState[]): { areaHa: number; minBidEur: number } {
  let areaHa = 0
  let minBidEur = 0
  for (const row of rows) {
    if (isRowEmpty(row)) continue
    areaHa += parseDecimal(row.areaHa) ?? 0
    minBidEur += parseDecimal(row.minBidEur) ?? 0
  }
  return { areaHa, minBidEur }
}

/**
 * Publish-gate mirror for the Ülevaade summary: the stored reserve value is
 * secret, so a masked-but-stored reserve stands in with a dummy positive
 * amount (same substitute rule as `validateAuctionDraft`). Package-lot area/
 * volume totals come from the rows; other lots use the step-3 scalars, which
 * is what the stored rows of a legacy lot would hold anyway.
 */
function gateSubjectOf(
  initial: AuctionWizardInitial,
  state: AuctionWizardState,
): AuctionGateSubject {
  const area = parseDecimal(state.areaHa)
  const volume = parseDecimal(state.volumeM3)
  const minBid = parseDecimal(state.minBidEur)
  const packageRows: Record<string, unknown>[] =
    state.objectType === 'pakett'
      ? packageRowsPayload(state.packageRows)
      : [
          ...(area !== undefined ? [{ areaHa: area }] : []),
          ...(volume !== undefined ? [{ volumeM3: volume }] : []),
        ]
  const reserve = parseDecimal(state.reserveEur)
  return {
    objectType: state.objectType,
    type: state.auctionType,
    isQuickAuction: state.isQuickAuction,
    startsAt: tallinnWallTimeToUtcIso(state.startsAt),
    endsAt: tallinnWallTimeToUtcIso(state.endsAt),
    minBidCents: minBid !== undefined && minBid >= 0 ? Math.round(minBid * 100) : 0,
    reservePriceCents: initial.hasReserve || reserve !== undefined ? 1 : null,
    cadastres: state.cadastres.map((value) => value.trim()).filter((value) => value !== ''),
    countyId: state.countyId,
    parishId: state.parishId,
    packageRows,
    media: state.media.map((item) => ({ url: item.url, alt: item.alt })),
  }
}

export interface WizardIssue {
  /** Canonical step number (1-7) the fix lives on. */
  step: number
  field: string
  message: string
  severity: 'error' | 'warning'
}

/**
 * Dedupe key merging zod paths (`media.0.alt`) and gate paths
 * (`media[1].alt`) onto their collection slot.
 */
function issueKey(field: string): string {
  const match = /^[a-zA-Z]+(?:\.\d+|\[\d+\])?/.exec(field)
  return match === null ? field : match[0]
}

/**
 * Every Ülevaade failure in one list: schema issues first, then publish-gate
 * findings the schema does not express (alt texts, area totals). Same-slot
 * duplicates collapse so a failure never shows twice.
 */
export function reviewIssues(
  initial: AuctionWizardInitial,
  state: AuctionWizardState,
  options: Pick<AuctionWizardOptions, 'canFeeOverride' | 'canReassignSpecialist'>,
): WizardIssue[] {
  const schemaErrors = validateAuctionDraft(initial, state, options)
  const issues: WizardIssue[] = Object.entries(schemaErrors).map(([field, message]) => ({
    step: stepForField(field) ?? 7,
    field,
    message,
    severity: 'error',
  }))

  const seen = new Set(Object.keys(schemaErrors).map(issueKey))
  const gates = collectPublishGateFailures(gateSubjectOf(initial, state))
  const pushGate = (gate: { step: string; field: string; message: string }, severity: WizardIssue['severity']): void => {
    const key = issueKey(gate.field)
    if (seen.has(key)) return
    seen.add(key)
    issues.push({
      step: stepForField(gate.field) ?? 7,
      field: gate.field,
      message: gate.message,
      severity,
    })
  }
  for (const gate of gates.blocking) pushGate(gate, 'error')
  for (const gate of gates.warnings) pushGate(gate, 'warning')
  return issues
}

/**
 * Submit gate: schema errors plus gate-blocking findings. Warnings never
 * block a save or a publish.
 */
export function validateWizardForSubmit(
  initial: AuctionWizardInitial,
  state: AuctionWizardState,
  options: Pick<AuctionWizardOptions, 'canFeeOverride' | 'canReassignSpecialist'>,
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of reviewIssues(initial, state, options)) {
    if (issue.severity !== 'error') continue
    errors[issue.field] ??= issue.message
  }
  return errors
}

export const SPECIES_OPTIONS: readonly { value: string; label: string }[] = speciesCodes.map(
  (code) => ({ value: code, label: code }),
)

export const LOGGING_TYPE_OPTIONS: readonly { value: string; label: string }[] =
  loggingTypeCodes.map((code) => ({ value: code, label: code }))
