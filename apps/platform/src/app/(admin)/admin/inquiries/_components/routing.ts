import type { ServiceRequestType } from '@/lib/data/schema'

/**
 * Routing-panel and forward-payload model for the partner marketplace
 * (design 10). Pure functions so the ranking and the payload whitelist
 * stay unit-testable without a database.
 */

export interface RoutingPartnerInput {
  id: string
  name: string
  capacity: number
  contactEmail: string | null
  serviceTypes: readonly unknown[] | null
  /** null or empty = Kogu Eesti (every county). */
  counties: readonly unknown[] | null
  active: boolean
}

export interface RoutingCandidate {
  partner: RoutingPartnerInput
  /** Explicit coverage of the request county (ranks ahead of nationwide). */
  countyMatch: boolean
  openCount: number
  atCapacity: boolean
  alreadySent: boolean
  preselected: boolean
}

export interface RankRoutingOptions {
  type: ServiceRequestType
  /** County code from the payload; null for kava. */
  county: string | null
  openCounts: Record<string, number>
  sentPartnerIds: ReadonlySet<string>
  preselectCount: number
}

function listIncludes(list: readonly unknown[] | null, value: string): boolean {
  return Array.isArray(list) && list.includes(value)
}

function hasExplicitCoverage(partner: RoutingPartnerInput, county: string): boolean {
  return partner.counties != null && partner.counties.length > 0 && listIncludes(partner.counties, county)
}

/** Service type + county coverage + active; null county lets everyone in. */
export function partnerServesRequest(
  partner: RoutingPartnerInput,
  type: ServiceRequestType,
  county: string | null,
): boolean {
  return (
    partner.active &&
    listIncludes(partner.serviceTypes, type) &&
    (county == null ||
      partner.counties == null ||
      partner.counties.length === 0 ||
      listIncludes(partner.counties, county))
  )
}

/**
 * Candidates for the routing panel. Order: explicit county match first,
 * then nationwide partners, each group by fewest open requests. Top N
 * unsent partners are preselected (setting default 3).
 */
export function rankRoutingCandidates(
  partners: readonly RoutingPartnerInput[],
  options: RankRoutingOptions,
): RoutingCandidate[] {
  const candidates: RoutingCandidate[] = partners
    .filter((partner) => partnerServesRequest(partner, options.type, options.county))
    .map((partner) => {
      const openCount = options.openCounts[partner.id] ?? 0
      return {
        partner,
        countyMatch:
          options.county != null && hasExplicitCoverage(partner, options.county),
        openCount,
        atCapacity: partner.capacity > 0 && openCount >= partner.capacity,
        alreadySent: options.sentPartnerIds.has(partner.id),
        preselected: false,
      }
    })
  candidates.sort((a, b) => a.openCount - b.openCount)
  candidates.sort((a, b) => Number(b.countyMatch) - Number(a.countyMatch))

  let preselected = 0
  for (const candidate of candidates) {
    if (candidate.alreadySent) continue
    if (preselected < options.preselectCount) {
      candidate.preselected = true
      preselected += 1
    }
  }
  return candidates
}

// ---------------------------------------------------------------------------
// Seaded-driven routing knobs (task 8.6). The settings row has no dedicated
// column, so the values ride the featureFlags TEXT-JSON under a reserved
// key — the same additive pattern as auctionDefaults and companyApproveRights.
// Until the Seaded form gains the field, the documented design default (3)
// applies.
// ---------------------------------------------------------------------------

export const ROUTING_SETTINGS_FLAGS_KEY = 'inquiryRouting'

export const DEFAULT_PRESELECT_COUNT = 3
export const PRESELECT_COUNT_BOUNDS = { min: 0, max: 10 } as const

export function preselectCountFromFlags(flags: unknown): number {
  if (typeof flags !== 'object' || flags === null || Array.isArray(flags)) {
    return DEFAULT_PRESELECT_COUNT
  }
  const raw = (flags as Record<string, unknown>)[ROUTING_SETTINGS_FLAGS_KEY]
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return DEFAULT_PRESELECT_COUNT
  }
  const value = (raw as Record<string, unknown>).preselectCount
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= PRESELECT_COUNT_BOUNDS.min &&
    value <= PRESELECT_COUNT_BOUNDS.max
    ? value
    : DEFAULT_PRESELECT_COUNT
}

// ---------------------------------------------------------------------------
// Manual e-mail copy fallback (task 8.6): when no partner matches, the
// operator copies the rendered e-mail text and sends it by hand. The text
// mirrors the forward e-mail and stays on the minimized-payload whitelist.
// ---------------------------------------------------------------------------

const MANUAL_EMAIL_LABELS: Record<string, string> = {
  type: 'Tüüp',
  contact: 'Kontakt',
  cadastres: 'Katastritunnused',
  county: 'Maakond',
  paper_copy: 'Kava paberkandjal',
  provisions: 'Ülesanded ja tingimused',
  services: 'Teenused',
  comment: 'Kommentaar',
}

function manualEmailValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').join(', ')
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined && item !== null && item !== '')
      .map(([key, item]) => `${key}: ${manualEmailValue(item)}`)
      .join(', ')
  }
  return ''
}

export interface ManualForwardEmail {
  subject: string
  body: string
}

export function buildManualForwardEmail(input: {
  type: ServiceRequestType
  payload: Record<string, unknown>
  attachments: readonly unknown[]
}): ManualForwardEmail {
  const subject = `Erametsa päring: ${input.type}`
  const minimized = buildMinimizedForwardPayload(input.payload)
  const lines = Object.entries(minimized).map(
    ([key, value]) => `${MANUAL_EMAIL_LABELS[key] ?? key}: ${manualEmailValue(value)}`,
  )
  const attachments = input.attachments.filter(
    (attachment): attachment is string => typeof attachment === 'string' && attachment !== '',
  )
  if (attachments.length > 0) {
    lines.push(`Manused: ${attachments.join(', ')}`)
  }
  lines.push('Andmed on edastatud Erametsad OÜ vahendusel. Küsimuste korral vastake otse kliendile.')
  return { subject, body: lines.join('\n') }
}

const FORWARD_PAYLOAD_KEYS = [
  'type',
  'contact',
  'cadastres',
  'county',
  'paper_copy',
  'provisions',
  'services',
  'comment',
] as const

/**
 * Server-side enforcement of the minimal-payload rule (design 10): the
 * partner receives contact and property data only. isikukood, IP, source
 * tracking and consent metadata never leave the admin surface.
 */
export function buildMinimizedForwardPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const minimized: Record<string, unknown> = {}
  for (const key of FORWARD_PAYLOAD_KEYS) {
    const value = payload[key]
    if (value !== undefined && value !== null && value !== '') {
      minimized[key] = value
    }
  }
  return minimized
}

/**
 * Design 10: partners must respond within 7 days of the forward. From 5
 * days on, the request counts as approaching the deadline; past 7 days
 * without any response it is expired.
 */
export const RESPONSE_WINDOW_DAYS = 7
export const RESPONSE_WINDOW_APPROACHING_DAYS = 5

export type ResponseDeadlineState = 'pending' | 'approaching' | 'expired'

export interface ResponseDeadlineInput {
  /** Forward time; null for requests never sent to a partner. */
  routedAt: string | null
  /** First partner response; any response stops the deadline clock. */
  respondedAt: string | null
  nowMs: number
}

export function responseDeadlineState(
  input: ResponseDeadlineInput,
): ResponseDeadlineState | null {
  if (input.respondedAt != null || input.routedAt == null) return null
  const routedMs = Date.parse(input.routedAt)
  if (Number.isNaN(routedMs)) return null
  const elapsedDays = (input.nowMs - routedMs) / (24 * 3600 * 1000)
  if (elapsedDays >= RESPONSE_WINDOW_DAYS) return 'expired'
  if (elapsedDays >= RESPONSE_WINDOW_APPROACHING_DAYS) return 'approaching'
  return 'pending'
}

export const ATTACHMENT_LINK_TTL_DAYS = 14

export interface ForwardAttachmentLink {
  key: string
  url: string
  expiresAt: string
}

/**
 * Attachment links expire 14 days after the forward; they are recorded in
 * the forwarding log next to the disclosure.
 */
export function buildAttachmentLinks(
  attachments: readonly unknown[],
  forwardedAtMs: number,
): ForwardAttachmentLink[] {
  const expiresAt = new Date(
    forwardedAtMs + ATTACHMENT_LINK_TTL_DAYS * 24 * 3600 * 1000,
  ).toISOString()
  return attachments
    .filter((attachment): attachment is string => typeof attachment === 'string' && attachment !== '')
    .map((key) => ({
      key,
      url: `/api/v1/media/${encodeURIComponent(key)}`,
      expiresAt,
    }))
}
