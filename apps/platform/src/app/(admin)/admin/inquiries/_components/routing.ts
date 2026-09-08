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
