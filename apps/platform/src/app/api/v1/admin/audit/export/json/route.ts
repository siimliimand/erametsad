import {
  AUDIT_EXPORT_FETCH_LIMIT,
  AUDIT_EXPORT_STAFF_LIMIT,
  buildAuditExportFilename,
  buildAuditExportRow,
  buildAuditJson,
  filterAuditEntries,
  parseAuditExportFilters,
  resolveActorFilter,
} from '../_lib/audit-export'

import { requireAdminRepositories } from '@/app/(admin)/_lib/admin'
import { can, staffRoles, type StaffRole } from '@/app/(admin)/_lib/permissions'
import type { UserDoc, WhereClause } from '@/lib/data/repositories'


export const dynamic = 'force-dynamic'

/**
 * Audit log JSON export (task 15.4, downloads stay on routes). Scoped
 * exactly like the audit list page: audit:read required, an admin always
 * exports only its own entries, a superadmin sees all. The export event is
 * itself audited (`audit.export`, anticipated in the action registry) and
 * the entry is written before the JSON is returned.
 */
export async function GET(request: Request): Promise<Response> {
  // Redirects to the login page when the admin cookie is missing or invalid.
  const { session, repositories } = await requireAdminRepositories()
  const role: StaffRole = session.role
  if (!can(role, 'audit:read')) {
    return Response.json({ error: 'Ainult superadmin ja administraator.' }, { status: 403 })
  }

  const params = parseAuditExportFilters(new URL(request.url).searchParams)
  const filters = {
    actorFilter: resolveActorFilter(role, session.userId, params.actor),
    group: params.group,
    entityType: params.entityType,
    entityId: params.entityId,
    fromIso: params.fromIso,
    toIso: params.toIso,
  }

  const { docs } = await repositories.find({
    collection: 'audit-entry',
    sort: '-createdAt',
    pagination: false,
    limit: AUDIT_EXPORT_FETCH_LIMIT,
  })
  const filtered = filterAuditEntries(docs, filters)

  // Staff list powers the batch actor name/role resolution (same as the list).
  const staffUsers: UserDoc[] = await repositories
    .find({
      collection: 'users',
      where: { role: { in: staffRoles } } satisfies WhereClause,
      sort: 'name',
      pagination: false,
      limit: AUDIT_EXPORT_STAFF_LIMIT,
    })
    .then((result) => result.docs)
  const actorById = new Map(staffUsers.map((user) => [user.id, user]))

  const rows = filtered.map((doc) => buildAuditExportRow(doc, actorById))

  await repositories.create({
    collection: 'audit-entry',
    data: {
      actorId: session.userId,
      action: 'audit.export',
      entityType: 'audit-entry',
      entityId: 'bulk',
      after: {
        format: 'json',
        rowCount: rows.length,
        filters: {
          ...(filters.actorFilter ? { actor: filters.actorFilter } : {}),
          ...(filters.group ? { group: filters.group } : {}),
          ...(filters.entityType ? { entityType: filters.entityType } : {}),
          ...(filters.entityId ? { entityId: filters.entityId } : {}),
          ...(filters.fromIso ? { from: filters.fromIso } : {}),
          ...(filters.toIso ? { to: filters.toIso } : {}),
        },
      },
    },
  })

  return new Response(buildAuditJson(rows), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${buildAuditExportFilename('json', new Date())}"`,
      'cache-control': 'no-store',
    },
  })
}
