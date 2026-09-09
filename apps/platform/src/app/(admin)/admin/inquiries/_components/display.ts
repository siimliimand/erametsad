// Task 8.5 display helpers for the inquiries table: GDPR name masking in
// the list (the full name stays visible in the detail panel), and a short
// sisu preview built from the submitted payload.

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

/**
 * Masks the client name for the table: the first part stays readable,
 * every later part collapses to an initial ("Priit Põhjamets" -> "Priit
 * P."). Mirrors the maskIsikukood approach — a partial view is enough to
 * recognise the row without exposing the full name in the list.
 */
export function maskClientName(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') return '—'
  const parts = value.trim().split(/\s+/)
  const first = parts[0] ?? ''
  if (parts.length === 1) return `${first.slice(0, 1)}.`
  const initials = parts
    .slice(1)
    .map((part) => `${part.slice(0, 1)}.`)
    .join(' ')
  return `${first} ${initials}`
}

const SISU_PREVIEW_MAX_LENGTH = 60

/**
 * Short content preview for the table: comment, then provisions, then the
 * service list, then the cadastre count. Empty payloads show a dash.
 */
export function sisuPreview(payload: unknown): string {
  const record = asRecord(payload)
  const candidates: string[] = []
  if (typeof record.comment === 'string' && record.comment.trim() !== '') {
    candidates.push(record.comment.trim())
  }
  if (typeof record.provisions === 'string' && record.provisions.trim() !== '') {
    candidates.push(record.provisions.trim())
  }
  const services = asStringArray(record.services)
  if (services.length > 0) {
    candidates.push(`Teenused: ${services.join(', ')}`)
  }
  const cadastres = asStringArray(record.cadastres)
  if (cadastres.length > 0) {
    candidates.push(`Katastrid: ${String(cadastres.length)}`)
  }
  const text = candidates[0] ?? ''
  if (text === '') return '—'
  return text.length <= SISU_PREVIEW_MAX_LENGTH
    ? text
    : `${text.slice(0, SISU_PREVIEW_MAX_LENGTH - 1)}…`
}
