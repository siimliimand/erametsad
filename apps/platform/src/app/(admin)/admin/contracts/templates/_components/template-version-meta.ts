/**
 * Version metadata for the template cards (spec admin-commerce-ops): the
 * uploader, the active period, and the generated-contracts count are not
 * columns on contract_templates, so they derive from the audit trail and a
 * bounded contracts fetch. A per-version free-text note has no storage yet —
 * the UI renders an em dash until the schema gains the column.
 */

export interface TemplateAuditEntry {
  entityId: string | null
  action: string
  actorId: string | null
  createdAt: string
}

export interface ActivePeriod {
  from: string | null
  to: string | null
}

const UPLOAD_ACTIONS = new Set(['template.upload', 'template.draft_save'])
const ACTIVATE_ACTION = 'template.activate'
const DEACTIVATE_ACTION = 'template.deactivate'

/**
 * First uploader (or draft saver) per template version row. Entries arrive
 * newest first, so the scan keeps the earliest action per entity.
 */
export function uploaderByTemplateId(
  entries: readonly TemplateAuditEntry[],
): Map<string, string | null> {
  const uploaders = new Map<string, string | null>()
  for (const entry of entries) {
    if (!entry.entityId || !UPLOAD_ACTIONS.has(entry.action)) continue
    if (uploaders.has(entry.entityId)) continue
    uploaders.set(entry.entityId, entry.actorId)
  }
  return uploaders
}

/**
 * Active window per version: from the first activation, until a later
 * deactivation. Versions whose row is still active get an open-ended
 * window (to stays null).
 */
export function activePeriodsByTemplateId(
  entries: readonly TemplateAuditEntry[],
  currentlyActiveIds: ReadonlySet<string>,
): Map<string, ActivePeriod> {
  const periods = new Map<string, ActivePeriod>()
  for (const entry of entries) {
    if (!entry.entityId) continue
    if (entry.action !== ACTIVATE_ACTION && entry.action !== DEACTIVATE_ACTION) continue
    const period = periods.get(entry.entityId) ?? { from: null, to: null }
    if (entry.action === ACTIVATE_ACTION) {
      // Newest first: the earliest activation wins as the window start.
      period.from = entry.createdAt
    } else {
      // First deactivation seen is the newest one; a null `to` stays open.
      period.to ??= entry.createdAt
    }
    periods.set(entry.entityId, period)
  }
  for (const [id, period] of periods) {
    if (currentlyActiveIds.has(id)) {
      period.to = null
    }
  }
  return periods
}

/** Generated-contract count per template version row (templateId is the version row). */
export function countContractsByTemplate(
  contracts: readonly { templateId: string }[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const contract of contracts) {
    counts.set(contract.templateId, (counts.get(contract.templateId) ?? 0) + 1)
  }
  return counts
}
