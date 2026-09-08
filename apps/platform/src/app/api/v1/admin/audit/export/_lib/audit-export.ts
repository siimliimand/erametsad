import { formatDateTime, userRoleLabels } from '@/app/(admin)/_lib/labels'
import type { StaffRole } from '@/app/(admin)/_lib/permissions'
import {
  entityTypeLabel,
  groupForAction,
  groupLabel,
  UNGROUPED_GROUP_ID,
} from '@/app/(admin)/admin/audit/_components/action-registry'
import type { AuditEntryDoc, UserDoc } from '@/lib/data/repositories'

/**
 * Pure helpers for the audit CSV/JSON export routes (task 15.4). Filtering
 * mirrors the audit list page exactly: same fetch bound, same filter set,
 * same self-view rule (an admin only ever exports its own entries; a
 * superadmin sees all). The CSV uses a semicolon delimiter and a UTF-8 BOM
 * because Estonian Excel treats the comma as the decimal separator — the
 * same convention as the leads and auctions exports.
 */

// Same bounded fetch as the list page (the repository layer has no range
// operators; the date filter runs in JS).
export const AUDIT_EXPORT_FETCH_LIMIT = 2000

export const AUDIT_EXPORT_STAFF_LIMIT = 500

export const AUDIT_CSV_HEADERS = [
  'ID',
  'Aeg',
  'Tegija',
  'Roll',
  'Tegevus',
  'Rühm',
  'Olem',
  'Olemi ID',
  'Enne/Järel',
] as const

const CSV_DELIMITER = ';'
const CSV_BOM = '\uFEFF'
const CSV_ROW_SEPARATOR = '\r\n'

/**
 * Date-only bounds expand to full local days in Europe/Tallinn. The from
 * bound uses the winter offset (earliest possible start of day) and the to
 * bound the summer offset (latest possible end of day), so a filtered day
 * is always fully covered regardless of DST. (Same logic as the audit and
 * auctions lists.)
 */
export function tallinnDayStartIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return new Date(`${day}T00:00:00+02:00`).toISOString()
}

export function tallinnDayEndIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return new Date(`${day}T23:59:59+03:00`).toISOString()
}

export interface AuditExportFilterParams {
  actor: string
  group: string
  entityType: string
  entityId: string
  fromIso: string | null
  toIso: string | null
}

/** Reads the list-page filter names (actor, group, entityType, entityId, from, to). */
export function parseAuditExportFilters(params: URLSearchParams): AuditExportFilterParams {
  return {
    actor: (params.get('actor') ?? '').trim(),
    group: (params.get('group') ?? '').trim(),
    entityType: (params.get('entityType') ?? '').trim(),
    entityId: (params.get('entityId') ?? '').trim(),
    fromIso: tallinnDayStartIso(params.get('from') ?? ''),
    toIso: tallinnDayEndIso(params.get('to') ?? ''),
  }
}

/**
 * Self-view scoping, the same rule the list page applies: an admin sees
 * only its own entries regardless of the actor param; a superadmin may
 * filter by any actor. Specialist and seller never reach this point
 * (no audit:read).
 */
export function resolveActorFilter(
  role: StaffRole,
  userId: string,
  actorParam: string,
): string | undefined {
  if (role === 'admin') return userId
  if (role === 'superadmin') return actorParam || undefined
  return undefined
}

export interface AuditExportFilters {
  actorFilter?: string | undefined
  group?: string | undefined
  entityType?: string | undefined
  entityId?: string | undefined
  fromIso?: string | null | undefined
  toIso?: string | null | undefined
}

/** Same predicate order as the audit list page's `docs.filter` block. */
export function filterAuditEntries(
  docs: readonly AuditEntryDoc[],
  filters: AuditExportFilters,
): AuditEntryDoc[] {
  return docs.filter((doc) => {
    if (filters.actorFilter && doc.actorId !== filters.actorFilter) return false
    if (filters.group) {
      const docGroup = groupForAction(doc.action)
      if (filters.group === UNGROUPED_GROUP_ID) {
        if (docGroup !== null) return false
      } else if (docGroup !== filters.group) {
        return false
      }
    }
    if (filters.entityType && doc.entityType !== filters.entityType) return false
    if (filters.entityId && doc.entityId !== filters.entityId) return false
    if (filters.fromIso && doc.createdAt < filters.fromIso) return false
    if (filters.toIso && doc.createdAt > filters.toIso) return false
    return true
  })
}

/** One export row per entry: list columns plus the drawer payload fields. */
export function buildAuditExportRow(
  doc: AuditEntryDoc,
  actorById: ReadonlyMap<string, UserDoc>,
): AuditExportRow {
  const actor = doc.actorId ? actorById.get(doc.actorId) : undefined
  return {
    id: doc.id,
    createdAt: doc.createdAt,
    actorId: doc.actorId,
    actorName: actor ? (actor.name ?? actor.email) : (doc.actorId ?? '—'),
    actorRole: actor ? userRoleLabels[actor.role] : null,
    action: doc.action,
    actionGroup: groupForAction(doc.action) ?? UNGROUPED_GROUP_ID,
    entityType: doc.entityType,
    entityId: doc.entityId,
    hasDiff: doc.before !== null && doc.before !== undefined,
    before: doc.before,
    after: doc.after,
    prevHash: doc.prevHash,
    hash: doc.hash,
  }
}

export interface AuditExportRow {
  id: string
  createdAt: string
  actorId: string | null
  actorName: string
  actorRole: string | null
  action: string
  actionGroup: string
  entityType: string | null
  entityId: string | null
  hasDiff: boolean
  before: unknown
  after: unknown
  prevHash: string | null
  hash: string | null
}

function formatCsvField(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function buildAuditCsv(rows: readonly AuditExportRow[]): string {
  const lines = [
    AUDIT_CSV_HEADERS.join(CSV_DELIMITER),
    ...rows.map((row) =>
      [
        row.id,
        formatDateTime(row.createdAt),
        row.actorName,
        row.actorRole ?? '',
        row.action,
        groupLabel(row.actionGroup),
        entityTypeLabel(row.entityType),
        row.entityId ?? '',
        row.hasDiff ? 'jah' : 'ei',
      ]
        .map(formatCsvField)
        .join(CSV_DELIMITER),
    ),
  ]
  return `${CSV_BOM}${lines.join(CSV_ROW_SEPARATOR)}${CSV_ROW_SEPARATOR}`
}

/** JSON export: an array of entry objects (list fields plus payload and hash). */
export function buildAuditJson(rows: readonly AuditExportRow[]): string {
  return JSON.stringify(
    rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      actorId: row.actorId,
      actorName: row.actorName,
      actorRole: row.actorRole,
      action: row.action,
      actionGroup: row.actionGroup,
      entityType: row.entityType,
      entityId: row.entityId,
      before: row.before,
      after: row.after,
      prevHash: row.prevHash,
      hash: row.hash,
    })),
    null,
    2,
  )
}

export function buildAuditExportFilename(extension: 'csv' | 'json', now: Date): string {
  return `auditlogi-${now.toISOString().slice(0, 10)}.${extension}`
}
