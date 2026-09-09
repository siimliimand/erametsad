import { contractStatuses, contractTemplateTypes } from '@/lib/data/schema'
import type { ContractStatus, ContractTemplateType } from '@/lib/data/schema'

/**
 * Contracts list search and filtering (spec admin-commerce-ops). An
 * all-hex query of 8+ characters is treated as a transaction reference
 * (the signing content hash) and matched by prefix against the hash and
 * the contract id; everything else is case-insensitive freetext over the
 * auction title, the party names, and the contract number. Date-range and
 * freetext filtering run in JS over one bounded fetch (users/auctions
 * list pattern) because the repository layer has no >= operator.
 */
export type ContractSearchQuery =
  | { kind: 'ref'; needle: string }
  | { kind: 'freetext'; needle: string }

/** Display page size, matching the auctions list. */
export const CONTRACTS_PAGE_SIZE = 25

/** Single bounded fetch for the JS-side filters. */
export const CONTRACTS_FETCH_LIMIT = 2000

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX_REF_PATTERN = /^[0-9a-f]{8,64}$/i

export function contractNumber(id: string): string {
  return id.slice(0, 8)
}

/** Truncated mono display for a transaction reference; title carries the full value. */
export function transactionRefLabel(ref: string): string {
  return ref.length <= 12 ? ref : `${ref.slice(0, 12)}…`
}

export function classifyContractSearch(raw: string): ContractSearchQuery | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const collapsed = trimmed.replace(/\s+/g, '').toLowerCase()
  if (UUID_PATTERN.test(collapsed) || HEX_REF_PATTERN.test(collapsed)) {
    return { kind: 'ref', needle: collapsed }
  }
  return { kind: 'freetext', needle: trimmed.toLowerCase() }
}

export interface SearchableContractRow {
  id: string
  contentHash: string | null
  auctionTitle: string
  sellerName: string
  buyerName: string
}

export function matchesContractSearch(
  row: SearchableContractRow,
  query: ContractSearchQuery | null,
): boolean {
  if (query === null) return true
  const needle = query.needle.toLowerCase()
  if (query.kind === 'ref') {
    return row.id.toLowerCase().startsWith(needle)
      || (row.contentHash?.toLowerCase().startsWith(needle) ?? false)
  }
  if (row.auctionTitle.toLowerCase().includes(needle)) return true
  if (row.sellerName.toLowerCase().includes(needle)) return true
  if (row.buyerName.toLowerCase().includes(needle)) return true
  if (row.id.toLowerCase().includes(needle)) return true
  return false
}

// ---------------------------------------------------------------------------
// Contracts list filters (spec admin-commerce-ops): tüüp / olek / kuupäev.
// ---------------------------------------------------------------------------

export interface ContractListFilters {
  type: ContractTemplateType | null
  status: ContractStatus | null
  fromIso: string | null
  toIso: string | null
}

/**
 * Date-only bounds expand to full local days in Europe/Tallinn. The from
 * bound uses the winter offset (earliest possible start of day) and the to
 * bound the summer offset (latest possible end of day), so a filtered day
 * is always fully covered regardless of DST (auctions list pattern).
 */
export function tallinnDayStartIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return new Date(`${day}T00:00:00+02:00`).toISOString()
}

export function tallinnDayEndIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return new Date(`${day}T23:59:59+03:00`).toISOString()
}

export function parseContractListFilters(raw: {
  type?: string | undefined
  status?: string | undefined
  from?: string | undefined
  to?: string | undefined
}): ContractListFilters {
  const isType = (value: string | undefined): value is ContractTemplateType =>
    typeof value === 'string' && (contractTemplateTypes as readonly string[]).includes(value)
  const isStatus = (value: string | undefined): value is ContractStatus =>
    typeof value === 'string' && (contractStatuses as readonly string[]).includes(value)
  return {
    type: isType(raw.type) ? raw.type : null,
    status: isStatus(raw.status) ? raw.status : null,
    fromIso: raw.from ? tallinnDayStartIso(raw.from) : null,
    toIso: raw.to ? tallinnDayEndIso(raw.to) : null,
  }
}

export function contractInDateRange(createdAt: string, filters: ContractListFilters): boolean {
  if (filters.fromIso !== null && createdAt < filters.fromIso) return false
  if (filters.toIso !== null && createdAt > filters.toIso) return false
  return true
}

// ---------------------------------------------------------------------------
// Pagination (spec admin-commerce-ops), auctions-list pattern.
// ---------------------------------------------------------------------------

export interface Paginated<T> {
  pageRows: T[]
  safePage: number
  pageCount: number
  totalCount: number
}

export function paginateRows<T>(rows: readonly T[], pageParam: string): Paginated<T> {
  const totalCount = rows.length
  const pageCount = Math.max(1, Math.ceil(totalCount / CONTRACTS_PAGE_SIZE))
  const requested = Number.parseInt(pageParam, 10)
  const safePage = Number.isFinite(requested) && requested > 0 ? Math.min(requested, pageCount) : 1
  return {
    pageRows: rows.slice((safePage - 1) * CONTRACTS_PAGE_SIZE, safePage * CONTRACTS_PAGE_SIZE),
    safePage,
    pageCount,
    totalCount,
  }
}
