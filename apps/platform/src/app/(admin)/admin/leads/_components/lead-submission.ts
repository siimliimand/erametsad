// Task 8.3: the original submitted message and attachments on the lead
// detail. The leads table has no message or attachment columns, so the
// submission survives only in the append-only creation audit entry
// (after.message / after.attachments). When no such entry exists — the
// case for every lead ingested so far — the resolver returns empty data
// and the detail section stays hidden.

export interface LeadAuditLike {
  action: string
  createdAt: string
  after?: unknown
}

export interface LeadSubmission {
  message: string | null
  attachments: string[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

/**
 * Reads the earliest creation audit entry; the first submitted message and
 * its attachment keys win over any later duplicates.
 */
export function resolveLeadSubmission(audits: readonly LeadAuditLike[]): LeadSubmission {
  const creates = audits
    .filter(
      (entry) => entry.action === 'lead.create' || entry.action === 'lead.create_manual',
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  const after = asRecord(creates[0]?.after)
  const message =
    typeof after.message === 'string' && after.message.trim() !== '' ? after.message : null
  const attachments = Array.isArray(after.attachments)
    ? after.attachments.filter((item): item is string => typeof item === 'string' && item !== '')
    : []
  return { message, attachments }
}

/** Download link for an attachment key; mirrors the forward-link pattern. */
export function leadAttachmentUrl(key: string): string {
  return `/api/v1/media/${encodeURIComponent(key)}`
}
