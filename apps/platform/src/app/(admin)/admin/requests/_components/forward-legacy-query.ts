type RawParams = Record<string, string | string[] | undefined>

/**
 * Re-serializes the full legacy query string so bookmarks built by the old
 * routes keep their viga/teade/detail (or muuda) parameters after the
 * redirect to the inquiries routes.
 */
export function forwardLegacyQuery(params: RawParams): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) search.append(key, entry)
    } else if (value !== undefined) {
      search.set(key, value)
    }
  }
  const qs = search.toString()
  return qs === '' ? '' : `?${qs}`
}
