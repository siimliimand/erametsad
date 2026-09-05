import { nodeIsikukoodCodec } from '@/lib/data/repositories'

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
