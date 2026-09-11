/**
 * D1 (portal-parity-gap-closure): `cut_deadline_year` is a derived column —
 * the year of the cutting deadline carried in the free-form `deadlines`
 * TEXT-JSON. Storing it keeps the year filter index-backed, which
 * json_extract in a WHERE clause cannot offer. The tolerant key set and
 * order mirror the lot dossier reader in the portal detail page.
 */
const CUT_DEADLINE_JSON_KEYS = ['loggingDeadline', 'logging', 'raie'] as const

/**
 * Year of the first deadlines JSON value under the tolerant keys that is a
 * non-empty, parseable date string; null when the JSON holds none.
 */
export function cutDeadlineYearFromDeadlines(deadlines: unknown): number | null {
  if (typeof deadlines !== 'object' || deadlines === null) return null
  const record = deadlines as Record<string, unknown>
  for (const key of CUT_DEADLINE_JSON_KEYS) {
    const value = record[key]
    if (typeof value !== 'string' || value.trim() === '') continue
    const time = Date.parse(value)
    if (!Number.isNaN(time)) return new Date(time).getUTCFullYear()
  }
  return null
}

/**
 * Write-path sync for auction create/update: whenever a write carries a
 * `deadlines` value, the derived column is recomputed in the same write so
 * admin edits can never drift. Writes without `deadlines` leave the stored
 * year untouched — the source JSON did not change. An explicitly passed
 * `cutDeadlineYear` is overwritten; the column is derived, never authored.
 */
export function syncCutDeadlineYear(
  collection: string,
  data: Record<string, unknown>,
): void {
  if (collection !== 'auctions') return
  if (!('deadlines' in data) || data.deadlines === undefined) return
  data.cutDeadlineYear = cutDeadlineYearFromDeadlines(data.deadlines)
}
