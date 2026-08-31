/**
 * "Display until" date, ISO-8601 TEXT per the data-layer convention. The
 * D1 schema has not shipped the column yet, so both the planned camelCase
 * property and the raw column spelling are accepted on the item object.
 */
function expiryOf(item: unknown): string | null {
  if (typeof item !== 'object' || item === null) return null
  const raw = (item as Record<string, unknown>).showUntil ?? (item as Record<string, unknown>).show_until
  return typeof raw === 'string' ? raw : null
}

/**
 * Items whose show_until date has passed do not render on the page or in
 * the JSON-LD. Absent or unparseable dates never hide content.
 */
export function isFaqItemVisible(item: unknown, now: Date = new Date()): boolean {
  const raw = expiryOf(item)
  if (!raw) return true
  const until = Date.parse(raw)
  return Number.isNaN(until) || until > now.getTime()
}
