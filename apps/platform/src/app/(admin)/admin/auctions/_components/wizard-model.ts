import {
  tallinnWallTimeToUtcIso,
  utcIsoToTallinnInputValue,
} from '../../content/_components/scheduled-publish'
import { attachmentTagFrom } from '../../media/_lib/media-upload'
import type { AttachmentTag } from '../../media/_lib/media-upload'
import {
  auctionInputSchema,
  collectPublishGateFailures,
  loggingTypeCodes,
  speciesCodes,
} from '../_lib/auction-schema'
import type { ApprovalOptionValue, AuctionGateSubject } from '../_lib/auction-schema'

import { auctionObjectTypes } from '@/lib/data/schema'
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

/** PDF attachment row (docs 03 step 5 files[]): PDF-only with a tag. */
export interface AuctionFileItemState {
  url: string
  tag: AttachmentTag
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
  /**
   * Rendi-/kasutusleping checkbox gating the lease deadline field (docs 03
   * step 3): checked shows and requires the deadline input. Optional so the
   * pre-5.7 seed paths stay valid, mirroring the `storageLocationApproval`
   * precedent; a stored lease deadline without the flag reads as checked.
   */
  hasLeaseAgreement?: boolean
  /**
   * Kooskõlastused (ladustamiskohad) and väljaveoteed codes ('seller' |
   * 'buyer' | 'approved'); '' = unset. Optional so the pre-5.1 seed paths
   * stay valid, mirroring the `files` precedent.
   */
  storageLocationApproval?: string
  removalRoads?: string
  /** Pakett passthrough so a wizard save never wipes the stored value. */
  propertyCount: number | null
  specialistId: string
  descriptionPublic: string
  descriptionSecondary: string
  media: AuctionMediaItemState[]
  /**
   * Optional so the pre-2.6 seed paths (auction-form) stay untouched: absent
   * means "never edited here" and the payload omits `files`, so stored
   * attachments survive partial updates. MediaStep writes it for new lots.
   */
  files?: AuctionFileItemState[]
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
  /**
   * Stored copy's updatedAt at load time; the conflict-detection base for
   * server autosave. Null/absent lets the first autosave adopt the server
   * version (the server shells do not pass it yet).
   */
  updatedAt?: string | null
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
  storageLocationApproval: 3,
  removalRoads: 3,
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
  files: 5,
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
  if (state.hasLeaseAgreement === true) deadlines.hasLeaseAgreement = true
  if (state.leaseDeadline !== '') deadlines.leaseDeadline = state.leaseDeadline
  const storageLocationApproval = state.storageLocationApproval ?? ''
  if (storageLocationApproval !== '') deadlines.storageLocationApproval = storageLocationApproval
  const removalRoads = state.removalRoads ?? ''
  if (removalRoads !== '') deadlines.removalRoads = removalRoads
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
  // `files` travels only once MediaStep owns the list; a save from a session
  // that never touched attachments stays absent and cannot wipe stored rows.
  if (state.files !== undefined) {
    payload.files = state.files.map((item) => ({ url: item.url, tag: item.tag }))
  }

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

/** Stored files JSON -> editable rows; unknown tags fall back to "muu". */
export function filesStateFrom(value: unknown): AuctionFileItemState[] {
  if (!Array.isArray(value)) return []
  const items: AuctionFileItemState[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    if (typeof record.url !== 'string' || record.url.trim() === '') continue
    items.push({ url: record.url, tag: attachmentTagFrom(record.tag) })
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

/** Kooskõlastused/väljaveoteed options (docs 03 step 3: müüja/ostja/kooskõlastatud). */
export const APPROVAL_OPTIONS: readonly { value: ApprovalOptionValue; label: string }[] = [
  { value: 'seller', label: 'Müüja' },
  { value: 'buyer', label: 'Ostja' },
  { value: 'approved', label: 'Kooskõlastatud' },
]

// ── Step rail marks (task 5.2; demo 03 wiz-side) ────────────────────────────

export type WizardStepMark = 'done' | 'current' | 'todo' | 'disabled'

export interface WizardRailStep {
  /** Canonical step number (1-7). */
  step: number
  id: string
  label: string
  mark: WizardStepMark
  /** Blocking defects landing on this step; always 0 for a hidden row. */
  defects: number
}

/**
 * Rail marks from the live per-step validation: a step is done when no
 * blocking defect lands on it and todo otherwise, the current step overrides
 * both, and hidden steps (Pakett for non-package lots) stay disabled.
 * Warnings are never defects — they do not block a save or a publish.
 */
export function wizardRailSteps(
  steps: readonly { id: string; label: string }[],
  hiddenStepIds: readonly string[],
  initial: AuctionWizardInitial,
  state: AuctionWizardState,
  options: Pick<AuctionWizardOptions, 'canFeeOverride' | 'canReassignSpecialist'>,
  currentStep: number,
): WizardRailStep[] {
  const hidden = new Set(hiddenStepIds)
  const defectsByStep = new Map<number, number>()
  for (const issue of reviewIssues(initial, state, options)) {
    if (issue.severity !== 'error') continue
    defectsByStep.set(issue.step, (defectsByStep.get(issue.step) ?? 0) + 1)
  }
  return steps.map((entry, index) => {
    const step = index + 1
    const isHidden = hidden.has(entry.id)
    const defects = isHidden ? 0 : (defectsByStep.get(step) ?? 0)
    const mark: WizardStepMark = isHidden
      ? 'disabled'
      : step === currentStep
        ? 'current'
        : defects > 0
          ? 'todo'
          : 'done'
    return { step, id: entry.id, label: entry.label, mark, defects }
  })
}

/** Rail footer line: "1 puudus", otherwise "N puudust". */
export function wizardDefectLabel(count: number): string {
  return count === 1 ? '1 puudus' : `${String(count)} puudust`
}

// ── Client draft autosave (task 5.3) ────────────────────────────────────────

const WIZARD_DRAFT_VERSION = 1

/** localStorage keys stay separate for unsaved and stored lots. */
export function wizardDraftKey(auctionId: string | null): string {
  return auctionId === null ? 'auction-draft:new' : `auction-draft:${auctionId}`
}

/** Stored wizard draft: the editable state plus the save time. */
export interface WizardDraft {
  state: AuctionWizardState
  /** ISO-8601 UTC save time. */
  savedAt: string
}

/**
 * Deterministic snapshot of the editable state for dirty compares. The
 * UI-only `reserveEditing` flag never takes part; `files` stays absent until
 * MediaStep owns the list, and JSON.stringify drops that key by itself.
 */
export function serializeWizardState(state: AuctionWizardState): string {
  return JSON.stringify({ ...state, reserveEditing: false })
}

/** Full draft record for localStorage. */
export function serializeWizardDraft(state: AuctionWizardState, savedAt: Date): string {
  return JSON.stringify({
    version: WIZARD_DRAFT_VERSION,
    state: { ...state, reserveEditing: false },
    savedAt: savedAt.toISOString(),
  })
}

/** True when any editable field differs; the reserve UI flag is ignored. */
export function wizardDraftDiffers(
  left: AuctionWizardState,
  right: AuctionWizardState,
): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const key of keys) {
    if (key === 'reserveEditing') continue
    const a = left[key as keyof AuctionWizardState]
    const b = right[key as keyof AuctionWizardState]
    if (a === b) continue
    if (
      typeof a === 'object' &&
      a !== null &&
      typeof b === 'object' &&
      b !== null &&
      JSON.stringify(a) === JSON.stringify(b)
    ) {
      continue
    }
    return true
  }
  return false
}

const DRAFT_STRING_KEYS = [
  'title',
  'slug',
  'antiSnipeMinutes',
  'startsAt',
  'endsAt',
  'minBidEur',
  'bidStepEur',
  'reserveEur',
  'feeOverridePercent',
  'countyId',
  'parishId',
  'address',
  'lat',
  'lng',
  'areaHa',
  'volumeM3',
  'loggingDeadline',
  'removalDeadline',
  'leaseDeadline',
  'specialistId',
  'descriptionPublic',
  'descriptionSecondary',
  'packageHeader',
] as const

const DRAFT_BOOLEAN_KEYS = ['isQuickAuction', 'antiSnipeEnabled'] as const

const DRAFT_STRING_ARRAY_KEYS = [
  'cadastres',
  'registryNumbers',
  'compartments',
  'forestNotifications',
  'species',
  'loggingTypes',
] as const

type DraftStrings = Record<(typeof DRAFT_STRING_KEYS)[number], string>
type DraftStringArrays = Record<(typeof DRAFT_STRING_ARRAY_KEYS)[number], string[]>

function draftString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function draftStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const items: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') return null
    items.push(entry)
  }
  return items
}

function draftMedia(value: unknown): AuctionMediaItemState[] | null {
  if (!Array.isArray(value)) return null
  const items: AuctionMediaItemState[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) return null
    const record = entry as Record<string, unknown>
    const url = draftString(record.url)
    const alt = draftString(record.alt)
    if (url === null || alt === null) return null
    const { focalX, focalY } = record
    items.push({
      url,
      alt,
      ...(typeof focalX === 'number' && Number.isFinite(focalX) ? { focalX } : {}),
      ...(typeof focalY === 'number' && Number.isFinite(focalY) ? { focalY } : {}),
    })
  }
  return items
}

function draftFiles(value: unknown): AuctionFileItemState[] | null {
  if (!Array.isArray(value)) return null
  const items: AuctionFileItemState[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) return null
    const record = entry as Record<string, unknown>
    const url = draftString(record.url)
    if (url === null) return null
    items.push({ url, tag: attachmentTagFrom(record.tag) })
  }
  return items
}

function draftPackageRows(value: unknown): PackageRowState[] | null {
  if (!Array.isArray(value)) return null
  const rows: PackageRowState[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) return null
    const record = entry as Record<string, unknown>
    const row: PackageRowState = {
      cadastre: '',
      registryNumber: '',
      county: '',
      areaHa: '',
      minBidEur: '',
    }
    for (const key of Object.keys(row) as (keyof PackageRowState)[]) {
      const cell = draftString(record[key])
      if (cell === null) return null
      row[key] = cell
    }
    rows.push(row)
  }
  return rows
}

/**
 * Field-shape guard for a stored draft. One mistyped field rejects the whole
 * draft: the version stamp (bumped on state-shape changes) is the migration
 * path, so a half-understood draft can never crash the wizard or silently
 * drop a field on restore.
 */
function draftStateFrom(value: unknown): AuctionWizardState | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const objectType = draftString(record.objectType)
  const auctionType = draftString(record.auctionType)
  if (
    objectType === null ||
    !(auctionObjectTypes as readonly string[]).includes(objectType) ||
    (auctionType !== 'open' && auctionType !== 'sealed')
  ) {
    return null
  }
  const typedObjectType = objectType as AuctionObjectType
  const strings = {} as DraftStrings
  for (const key of DRAFT_STRING_KEYS) {
    const parsed = draftString(record[key])
    if (parsed === null) return null
    strings[key] = parsed
  }
  for (const key of DRAFT_BOOLEAN_KEYS) {
    if (typeof record[key] !== 'boolean') return null
  }
  const stringArrays = {} as DraftStringArrays
  for (const key of DRAFT_STRING_ARRAY_KEYS) {
    const parsed = draftStringArray(record[key])
    if (parsed === null) return null
    stringArrays[key] = parsed
  }
  const propertyCount: unknown = record.propertyCount
  if (
    propertyCount !== null &&
    (typeof propertyCount !== 'number' || !Number.isFinite(propertyCount))
  ) {
    return null
  }
  const media = draftMedia(record.media)
  if (media === null) return null
  const packageRows = draftPackageRows(record.packageRows)
  if (packageRows === null) return null
  let files: AuctionFileItemState[] | undefined
  if (record.files !== undefined) {
    const parsed = draftFiles(record.files)
    if (parsed === null) return null
    files = parsed
  }
  // Additive state keys from task 5.1: absent in older version-1 drafts, so
  // they restore only when stored, keeping parsed drafts byte-equal to the
  // server state the dirty compare runs against.
  const storageLocationApproval = draftString(record.storageLocationApproval) ?? ''
  const removalRoads = draftString(record.removalRoads) ?? ''
  // Task 5.7, same additive rule: present only when true, so an unchecked
  // restore stays byte-equal to a server state without the key; a stored
  // lease deadline reads as checked.
  const hasLeaseAgreement =
    typeof record.hasLeaseAgreement === 'boolean' && record.hasLeaseAgreement
      ? true
      : strings.leaseDeadline !== ''
        ? true
        : undefined

  return {
    title: strings.title,
    slug: strings.slug,
    objectType: typedObjectType,
    auctionType,
    isQuickAuction: record.isQuickAuction === true,
    antiSnipeEnabled: record.antiSnipeEnabled === true,
    antiSnipeMinutes: strings.antiSnipeMinutes,
    startsAt: strings.startsAt,
    endsAt: strings.endsAt,
    minBidEur: strings.minBidEur,
    bidStepEur: strings.bidStepEur,
    reserveEur: strings.reserveEur,
    reserveEditing: false,
    feeOverridePercent: strings.feeOverridePercent,
    countyId: strings.countyId,
    parishId: strings.parishId,
    address: strings.address,
    lat: strings.lat,
    lng: strings.lng,
    cadastres: stringArrays.cadastres,
    registryNumbers: stringArrays.registryNumbers,
    compartments: stringArrays.compartments,
    forestNotifications: stringArrays.forestNotifications,
    species: stringArrays.species,
    loggingTypes: stringArrays.loggingTypes,
    areaHa: strings.areaHa,
    volumeM3: strings.volumeM3,
    loggingDeadline: strings.loggingDeadline,
    removalDeadline: strings.removalDeadline,
    leaseDeadline: strings.leaseDeadline,
    ...(hasLeaseAgreement !== undefined ? { hasLeaseAgreement } : {}),
    ...(storageLocationApproval !== '' ? { storageLocationApproval } : {}),
    ...(removalRoads !== '' ? { removalRoads } : {}),
    propertyCount: typeof propertyCount === 'number' ? propertyCount : null,
    specialistId: strings.specialistId,
    descriptionPublic: strings.descriptionPublic,
    descriptionSecondary: strings.descriptionSecondary,
    media,
    ...(files !== undefined ? { files } : {}),
    packageHeader: strings.packageHeader,
    packageRows,
  }
}

/**
 * Parses a stored draft. Junk JSON, a foreign version or any field failing
 * the shape guard yields null, and the wizard discards the draft instead of
 * restoring half of it.
 */
export function parseWizardDraft(raw: string): WizardDraft | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const record = parsed as Record<string, unknown>
  if (record.version !== WIZARD_DRAFT_VERSION) return null
  if (typeof record.savedAt !== 'string' || Number.isNaN(Date.parse(record.savedAt))) {
    return null
  }
  const state = draftStateFrom(record.state)
  return state === null ? null : { state, savedAt: record.savedAt }
}

// ── Step 7 read-only summary and published-lot diff (task 5.6) ──────────────

const SUMMARY_OBJECT_TYPE_LABELS: Record<AuctionObjectType, string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Metskinnistu',
  pakett: 'Pakett',
  kiire: 'Kiire oksjon',
  pollumaa: 'Põllumaa',
}

const SUMMARY_AUCTION_TYPE_LABELS: Record<AuctionTypeValue, string> = {
  open: 'Avatud',
  sealed: 'Suletud',
}

/** Tallinn wall input ("2026-12-01T12:00") -> "01.12.2026 12:00"; '' stays ''. */
function summaryWallValue(wall: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wall.trim())
  if (match === null) return ''
  const [, year, month, day, hour, minute] = match
  return `${day ?? ''}.${month ?? ''}.${year ?? ''} ${hour ?? ''}:${minute ?? ''}`
}

function summaryEuro(value: string): string {
  const parsed = parseDecimal(value)
  return parsed === undefined ? '' : `${value.trim()} €`
}

function summaryOrDash(value: string): string {
  return value.trim() === '' ? '—' : value.trim()
}

function nameFromOptions(
  list: readonly { id: string; name: string }[] | undefined,
  id: string,
): string {
  if (id.trim() === '') return ''
  return list?.find((entry) => entry.id === id)?.name ?? id
}

export interface WizardSummaryRow {
  label: string
  value: string
}

/** Read-only field summary for step 7 (Ülevaade), display-ready strings. */
export function wizardSummaryRows(
  initial: AuctionWizardInitial,
  state: AuctionWizardState,
  options: Pick<AuctionWizardOptions, 'counties' | 'parishes' | 'specialists'>,
): WizardSummaryRow[] {
  const countyName = nameFromOptions(options.counties, state.countyId)
  const parishName = nameFromOptions(options.parishes, state.parishId)
  const locationParts = [countyName, parishName, state.address.trim()].filter(
    (part) => part !== '',
  )
  const reserveValue =
    state.reserveEur.trim() !== ''
      ? summaryEuro(state.reserveEur)
      : initial.hasReserve
        ? 'määratud (varjatud)'
        : ''
  const rows: WizardSummaryRow[] = [
    { label: 'Nimi', value: summaryOrDash(state.title) },
    {
      label: 'Objekt',
      value:
        SUMMARY_OBJECT_TYPE_LABELS[state.objectType] +
        (state.isQuickAuction ? ' · kiiroksjon' : ''),
    },
    { label: 'Mehaanika', value: SUMMARY_AUCTION_TYPE_LABELS[state.auctionType] },
    { label: 'Algusaeg', value: summaryOrDash(summaryWallValue(state.startsAt)) },
    { label: 'Lõppaeg', value: summaryOrDash(summaryWallValue(state.endsAt)) },
    { label: 'Alghind', value: summaryOrDash(summaryEuro(state.minBidEur)) },
    { label: 'Pakkumuse samm', value: summaryOrDash(summaryEuro(state.bidStepEur)) },
    { label: 'Piirhind', value: summaryOrDash(reserveValue) },
    { label: 'Pindala', value: summaryOrDash(state.areaHa.trim() === '' ? '' : `${state.areaHa.trim()} ha`) },
    {
      label: 'Maht',
      value: summaryOrDash(state.volumeM3.trim() === '' ? '' : `${state.volumeM3.trim()} m³`),
    },
    { label: 'Asukoht', value: summaryOrDash(locationParts.join(', ')) },
    {
      label: 'Katastrid',
      value: summaryOrDash(state.cadastres.map((value) => value.trim()).filter((value) => value !== '').join(', ')),
    },
    {
      label: 'Spetsialist',
      value: summaryOrDash(nameFromOptions(options.specialists, state.specialistId)),
    },
  ]
  return rows
}

export interface WizardDiffRow {
  label: string
  saved: string
  current: string
  /**
   * True for reserve changes: both columns render "muudetud (varjatud)",
   * the stored amount never crosses to the client (spec scenario).
   */
  masked: boolean
}

interface DiffField {
  key: string
  label: string
  get: (state: AuctionWizardState) => string
}

const DIFF_FIELDS: readonly DiffField[] = [
  { key: 'title', label: 'Nimi', get: (s) => summaryOrDash(s.title) },
  {
    key: 'objectType',
    label: 'Objekt',
    get: (s) =>
      SUMMARY_OBJECT_TYPE_LABELS[s.objectType] + (s.isQuickAuction ? ' · kiiroksjon' : ''),
  },
  { key: 'auctionType', label: 'Mehaanika', get: (s) => SUMMARY_AUCTION_TYPE_LABELS[s.auctionType] },
  { key: 'startsAt', label: 'Algusaeg', get: (s) => summaryOrDash(summaryWallValue(s.startsAt)) },
  { key: 'endsAt', label: 'Lõppaeg', get: (s) => summaryOrDash(summaryWallValue(s.endsAt)) },
  { key: 'minBidEur', label: 'Alghind', get: (s) => summaryOrDash(summaryEuro(s.minBidEur)) },
  {
    key: 'bidStepEur',
    label: 'Pakkumuse samm',
    get: (s) => summaryOrDash(summaryEuro(s.bidStepEur)),
  },
  {
    key: 'areaHa',
    label: 'Pindala',
    get: (s) => summaryOrDash(s.areaHa.trim() === '' ? '' : `${s.areaHa.trim()} ha`),
  },
  {
    key: 'volumeM3',
    label: 'Maht',
    get: (s) => summaryOrDash(s.volumeM3.trim() === '' ? '' : `${s.volumeM3.trim()} m³`),
  },
  { key: 'address', label: 'Aadress', get: (s) => summaryOrDash(s.address) },
  {
    key: 'cadastres',
    label: 'Katastrid',
    get: (s) =>
      summaryOrDash(s.cadastres.map((value) => value.trim()).filter((value) => value !== '').join(', ')),
  },
]

function truncated(value: string, max = 80): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

/**
 * Two-column diff (salvestatud vs praegune) for editing a published lot:
 * only fields whose display value changed, in field order. The reserve row
 * appears masked on both sides whenever the operator entered an amount —
 * the stored value is write-only, so there is nothing else to show (D5).
 */
export function wizardFieldDiff(
  initial: AuctionWizardInitial,
  state: AuctionWizardState,
  options: Pick<AuctionWizardOptions, 'counties' | 'parishes' | 'specialists'>,
): WizardDiffRow[] {
  const rows: WizardDiffRow[] = []
  for (const field of DIFF_FIELDS) {
    const saved = field.get(initial.state)
    const current = field.get(state)
    if (saved === current) continue
    rows.push({ label: field.label, saved, current, masked: false })
  }
  for (const key of ['countyId', 'parishId', 'specialistId'] as const) {
    const list =
      key === 'countyId'
        ? options.counties
        : key === 'parishId'
          ? options.parishes
          : options.specialists
    const saved = nameFromOptions(list, initial.state[key])
    const current = nameFromOptions(list, state[key])
    if (saved === current) continue
    const label = key === 'countyId' ? 'Maakond' : key === 'parishId' ? 'Vald' : 'Spetsialist'
    rows.push({ label, saved: summaryOrDash(saved), current: summaryOrDash(current), masked: false })
  }
  const savedDescription = truncated(initial.state.descriptionPublic)
  const currentDescription = truncated(state.descriptionPublic)
  if (savedDescription !== currentDescription) {
    rows.push({
      label: 'Avalik info',
      saved: summaryOrDash(savedDescription),
      current: summaryOrDash(currentDescription),
      masked: false,
    })
  }
  if (initial.state.reserveEur !== state.reserveEur) {
    rows.push({
      label: 'Piirhind',
      saved: 'muudetud (varjatud)',
      current: 'muudetud (varjatud)',
      masked: true,
    })
  }
  return rows
}
