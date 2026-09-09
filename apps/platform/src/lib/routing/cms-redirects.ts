// CMS redirect resolution for the middleware (task 3.5). Pure helpers only:
// the middleware owns the module cache, the D1 reads, and the hit increment,
// so this file stays testable without a database.

import type { RedirectType } from '@/lib/data/schema'
import type { SqlStatement } from '@/lib/db'

export interface CmsRedirectRow {
  from: string
  to: string
  type: string
}

export interface CmsRedirect {
  from: string
  to: string
  type: RedirectType
}

/**
 * Builds the exact-match lookup from active redirect rows. Inactive rows and
 * rows with non-redirect types are skipped; `from` is the lookup key.
 */
export function redirectLookupByFrom(rows: readonly CmsRedirectRow[]): ReadonlyMap<string, CmsRedirect> {
  const map = new Map<string, CmsRedirect>()
  for (const row of rows) {
    if (row.type !== '301' && row.type !== '302') continue
    map.set(row.from, { from: row.from, to: row.to, type: row.type })
  }
  return map
}

/** Exact-path match against the active redirect map (no pattern matching). */
export function resolveCmsRedirect(
  lookup: ReadonlyMap<string, CmsRedirect>,
  pathname: string,
): CmsRedirect | null {
  return lookup.get(pathname) ?? null
}

/** The single cheap UPDATE that counts one served redirect. */
export function incrementCmsRedirectHitStatement(from: string): SqlStatement {
  return {
    sql: 'UPDATE redirects SET hits = hits + 1 WHERE "from" = ?',
    params: [from],
  }
}
