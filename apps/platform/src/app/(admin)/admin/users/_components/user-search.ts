import { nodeIsikukoodCodec } from '@/lib/data/repositories'
import { auctionObjectTypes, userRoles, userStatuses } from '@/lib/data/schema'

/**
 * Users list search classification. An 11-digit query is treated as an
 * isikukood and matched against the `isikukood_hash` index — the plaintext
 * column stays encrypted and is never queried. Everything else is a
 * case-insensitive freetext needle matched in JS over email/name, plus an
 * exact registrikood lookup on company profiles.
 */
export type UserSearchQuery =
  | { kind: 'isikukood'; hash: string }
  | { kind: 'freetext'; needle: string; registrikood: string }

export const ISIKUKOOD_PATTERN = /^\d{11}$/

export function normalizeSearchInput(raw: string): string {
  return raw.trim().replace(/\s+/g, '')
}

export function classifyUserSearch(raw: string): UserSearchQuery | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const collapsed = normalizeSearchInput(trimmed)
  if (ISIKUKOOD_PATTERN.test(collapsed)) {
    return { kind: 'isikukood', hash: nodeIsikukoodCodec.hash(collapsed) }
  }
  // Freetext keeps inner spaces: name needles like "Kalle Tamm" must match.
  return { kind: 'freetext', needle: trimmed.toLowerCase(), registrikood: trimmed }
}

export interface SearchableUser {
  id: string
  name: string | null
  email: string
  isikukoodHash: string | null
}

/** Freetext match over name and email; registrikood matches come from profiles. */
export function freetextMatchesUser(user: SearchableUser, query: UserSearchQuery): boolean {
  if (query.kind !== 'freetext') return true
  if (user.email.toLowerCase().includes(query.needle)) return true
  if (user.name?.toLowerCase().includes(query.needle)) return true
  return false
}

// ---------------------------------------------------------------------------
// Users list filters and sort (spec admin-people): profiil / olek / õigus.
// County has no data source on users or profiles, so it is not filterable.
// ---------------------------------------------------------------------------

export interface UserListFilters {
  role: (typeof userRoles)[number] | null
  status: (typeof userStatuses)[number] | null
  right: (typeof auctionObjectTypes)[number] | null
}

export function parseUserListFilters(raw: {
  profile?: string | undefined
  status?: string | undefined
  right?: string | undefined
}): UserListFilters {
  const isRole = (value: string | undefined): value is (typeof userRoles)[number] =>
    typeof value === 'string' && (userRoles as readonly string[]).includes(value)
  const isStatus = (value: string | undefined): value is (typeof userStatuses)[number] =>
    typeof value === 'string' && (userStatuses as readonly string[]).includes(value)
  const isRight = (value: string | undefined): value is (typeof auctionObjectTypes)[number] =>
    typeof value === 'string' && (auctionObjectTypes as readonly string[]).includes(value)
  return {
    role: isRole(raw.profile) ? raw.profile : null,
    status: isStatus(raw.status) ? raw.status : null,
    right: isRight(raw.right) ? raw.right : null,
  }
}

export type UserSortKey = 'lastLogin' | 'createdAt'

/** Spec: the default users sort is last login, newest first. */
export const DEFAULT_USER_SORT = '-lastLogin'

export interface UserListSortRow {
  createdAt: string
  lastLogin: string | null
}

/**
 * ISO-string compare keeps the sort pure and testable. Rows without any
 * login sort last in both directions; among them the newest accounts lead.
 */
export function sortUserRows<T extends UserListSortRow>(rows: readonly T[], sort: string): T[] {
  const dir: 1 | -1 = sort.startsWith('-') ? -1 : 1
  const key = dir === -1 ? sort.slice(1) : sort
  if (key !== 'lastLogin' && key !== 'createdAt') {
    return sortUserRows(rows, DEFAULT_USER_SORT)
  }
  const sorted = [...rows]
  sorted.sort((a, b) => {
    if (key === 'createdAt') return compareIso(a.createdAt, b.createdAt) * dir
    if (!a.lastLogin && !b.lastLogin) return compareIso(b.createdAt, a.createdAt)
    if (!a.lastLogin) return 1
    if (!b.lastLogin) return -1
    return compareIso(a.lastLogin, b.lastLogin) * dir
  })
  return sorted
}

function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** D1 allows at most 100 bound parameters per statement; keep headroom. */
export const SQL_ID_CHUNK_SIZE = 90

export function chunkIds(ids: readonly string[]): string[][] {
  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += SQL_ID_CHUNK_SIZE) {
    chunks.push(ids.slice(index, index + SQL_ID_CHUNK_SIZE))
  }
  return chunks
}
