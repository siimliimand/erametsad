// ---------------------------------------------------------------------------
// Pure helpers for the companies page ops (spec delta admin-people):
// history filters + pagination + audited CSV export, the SLA chip, and the
// approve rights defaults read from Seaded.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SLA chip (spec): amber when a pending request has waited more than 2 days,
// red after more than 5 days; the label is "oodatud {n} p".
// ---------------------------------------------------------------------------

export type SlaTone = 'neutral' | 'amber' | 'red'

export interface SlaChip {
  label: string
  tone: SlaTone
}

export function slaChip(waitingDays: number): SlaChip {
  const days = Math.max(0, Math.floor(waitingDays))
  return {
    label: `oodatud ${String(days)} p`,
    tone: days > 5 ? 'red' : days > 2 ? 'amber' : 'neutral',
  }
}

// ---------------------------------------------------------------------------
// History filters (decision, date, freetext) over decided requests.
// ---------------------------------------------------------------------------

export const companyDecisionFilters = ['approved', 'rejected'] as const
export type CompanyDecisionFilter = (typeof companyDecisionFilters)[number]

export interface CompanyHistoryFilters {
  decision: CompanyDecisionFilter | null
  /** YYYY-MM-DD; matches the reviewedAt UTC calendar day. */
  date: string | null
  /** Lowercase freetext needle over company, reg code, applicant, reviewer. */
  freetext: string
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function parseCompanyHistoryFilters(raw: {
  decision?: string | undefined
  date?: string | undefined
  q?: string | undefined
}): CompanyHistoryFilters {
  const decision = companyDecisionFilters.includes(
    raw.decision as CompanyDecisionFilter,
  )
    ? (raw.decision as CompanyDecisionFilter)
    : null
  const date = typeof raw.date === 'string' && DATE_PATTERN.test(raw.date) ? raw.date : null
  return { decision, date, freetext: (raw.q ?? '').trim().toLowerCase() }
}

interface HistoryFilterableRow {
  status: string
  reviewedAt: string | null
  searchText: string
}

export function matchesCompanyHistoryFilters(
  row: HistoryFilterableRow,
  filters: CompanyHistoryFilters,
): boolean {
  if (filters.decision !== null && row.status !== filters.decision) return false
  if (filters.date !== null && !(row.reviewedAt ?? '').startsWith(filters.date)) return false
  if (filters.freetext !== '' && !row.searchText.includes(filters.freetext)) return false
  return true
}

/**
 * Shared mapping for the history table and the CSV export: one decided
 * request plus its enrichment becomes a `CompanyHistoryRow`.
 */
export interface CompanyHistoryRowInput {
  request: {
    id: string
    regCode: string
    companyName: string | null
    requesterName: string | null
    requesterEmail: string | null
    status: 'approved' | 'rejected'
    reviewedAt: string | null
  }
  applicant: { name: string | null; isikukoodMasked: string } | null
  reviewerName: string | null
  rejectReason: string | null
  rights: readonly string[]
}

export function buildCompanyHistoryRow(input: CompanyHistoryRowInput): CompanyHistoryRow {
  const { request, applicant, reviewerName, rejectReason, rights } = input
  const applicantName = applicant?.name ?? request.requesterName ?? null
  return {
    id: request.id,
    reviewedAt: request.reviewedAt,
    companyName: request.companyName,
    regCode: request.regCode,
    applicant: `${applicantName ?? '—'} · ${applicant?.isikukoodMasked ?? '—'}`,
    status: request.status,
    reviewerName: reviewerName ?? '—',
    reason: rejectReason ?? '—',
    rights: [...rights],
    searchText: [
      request.companyName ?? '',
      request.regCode,
      applicantName ?? '',
      request.requesterEmail ?? '',
      reviewerName ?? '',
      rejectReason ?? '',
    ]
      .join(' ')
      .toLowerCase(),
  }
}

// ---------------------------------------------------------------------------
// Pagination for the filtered history table.
// ---------------------------------------------------------------------------

export const COMPANY_HISTORY_PAGE_SIZE = 20

export interface CompanyHistoryPage<Row> {
  rows: Row[]
  page: number
  pageCount: number
  total: number
}

export function paginateCompanyHistory<Row>(
  rows: readonly Row[],
  rawPage: string | undefined,
): CompanyHistoryPage<Row> {
  const pageCount = Math.max(1, Math.ceil(rows.length / COMPANY_HISTORY_PAGE_SIZE))
  const parsed = Number.parseInt(rawPage ?? '', 10)
  const page = Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, pageCount) : 1
  const start = (page - 1) * COMPANY_HISTORY_PAGE_SIZE
  return {
    rows: rows.slice(start, start + COMPANY_HISTORY_PAGE_SIZE),
    page,
    pageCount,
    total: rows.length,
  }
}

// ---------------------------------------------------------------------------
// CSV export of the filtered history (audited by the calling server action).
// ---------------------------------------------------------------------------

/** One decided request as shown in the history table and the CSV export. */
export interface CompanyHistoryRow {
  id: string
  reviewedAt: string | null
  companyName: string | null
  regCode: string
  applicant: string
  status: 'approved' | 'rejected'
  reviewerName: string
  reason: string
  rights: readonly string[]
  /** Lowercase haystack for the freetext filter. */
  searchText: string
}

const CSV_HEADER = [
  'Kuupäev',
  'Ettevõte',
  'Registrikood',
  'Taotleja',
  'Otsus',
  'Otsustaja',
  'Keeldumise põhjus',
  'Antud õigused',
] as const

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function buildCompanyHistoryCsv(rows: readonly CompanyHistoryRow[]): string {
  const lines = [CSV_HEADER.map(csvCell).join(',')]
  for (const row of rows) {
    lines.push(
      [
        row.reviewedAt ?? '',
        row.companyName ?? '',
        row.regCode,
        row.applicant,
        row.status === 'approved' ? 'Nõustutud' : 'Keeldutud',
        row.reviewerName,
        row.reason,
        row.rights.join(', '),
      ]
        .map(csvCell)
        .join(','),
    )
  }
  return lines.join('\r\n')
}

// ---------------------------------------------------------------------------
// Approve rights defaults from Seaded (spec: "approval rights defaults read
// from Seaded"). The settings row has no dedicated column, so the defaults
// ride the featureFlags TEXT-JSON under a reserved key — the same additive
// pattern as the auctionDefaults key. Until the Seaded form gains the field,
// the documented design default (raieõigus + kinnistu) applies.
// ---------------------------------------------------------------------------

export const COMPANY_APPROVE_RIGHTS_KEY = 'companyApproveRights'

// Local copy of the auction object types so client components can use this
// module without pulling in the Drizzle schema barrel; the approve action
// re-validates the posted values server-side.
const companyApproveRightTypes = ['raieoigus', 'kinnistu', 'kiire', 'pakett'] as const

export type CompanyApproveRight = (typeof companyApproveRightTypes)[number]

export const DEFAULT_COMPANY_APPROVE_RIGHTS: readonly CompanyApproveRight[] = [
  'raieoigus',
  'kinnistu',
]

export function companyApproveRightsDefaults(flags: unknown): CompanyApproveRight[] {
  if (typeof flags !== 'object' || flags === null || Array.isArray(flags)) {
    return [...DEFAULT_COMPANY_APPROVE_RIGHTS]
  }
  const raw = (flags as Record<string, unknown>)[COMPANY_APPROVE_RIGHTS_KEY]
  if (!Array.isArray(raw)) return [...DEFAULT_COMPANY_APPROVE_RIGHTS]
  const valid = new Set<string>(companyApproveRightTypes)
  const rights = [
    ...new Set(raw.filter((value): value is string => typeof value === 'string' && valid.has(value))),
  ] as CompanyApproveRight[]
  return rights.length > 0 ? rights : [...DEFAULT_COMPANY_APPROVE_RIGHTS]
}
