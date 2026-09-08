'use server'

import {
  sealedAuditActions,
  type SealedAuditLineView,
  type SealedAuditResult,
} from './sealed-audit-view'
import { requireAdminRepositories } from '../../../../../_lib/admin'
import { can, type StaffRole } from '../../../../../_lib/permissions'

// Newest-first strip depth; the full ledger stays in the audit page.
const SEALED_AUDIT_LINE_LIMIT = 25

/**
 * Permission-scoped read of this auction's sealed-opening audit lines,
 * newest first. Same scoping as the audit page: `audit:read` only, and an
 * `admin` (non-super) keeps the self-view scope — only own entries. No
 * payload fields (before/after) leave the server.
 */
export async function fetchSealedCeremonyAuditAction(
  auctionId: string,
): Promise<SealedAuditResult> {
  if (typeof auctionId !== 'string' || auctionId.length === 0 || auctionId.length > 64) {
    return { ok: false, error: 'Vigane oksjoni identifikaator.' }
  }

  const { session, repositories } = await requireAdminRepositories()
  const role: StaffRole = session.role
  if (!can(role, 'audit:read')) {
    return { ok: false, error: 'Auditlogi on nähtav ainult administraatorile ja peakasutajale.' }
  }
  const selfView = role === 'admin'

  if (sealedAuditActions.length === 0) return { ok: true, lines: [] }

  const { docs } = await repositories.find({
    collection: 'audit-entry',
    where: {
      and: [
        { entityType: { equals: 'auction' } },
        { entityId: { equals: auctionId } },
        { action: { in: sealedAuditActions } },
      ],
    },
    sort: '-createdAt',
    pagination: false,
    limit: SEALED_AUDIT_LINE_LIMIT,
  })
  const scoped = docs.filter((doc) => !selfView || doc.actorId === session.userId)

  // Resolve actor names in one bounded query so lines can render
  // "Avaja allkiri — Marit Vain (Administraator)" like the demo.
  const actorIds = [
    ...new Set(
      scoped
        .map((doc) => doc.actorId)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    ),
  ]
  const actors =
    actorIds.length === 0
      ? []
      : await repositories
          .find({
            collection: 'users',
            where: { id: { in: actorIds } },
            pagination: false,
            limit: actorIds.length,
          })
          .then((result) => result.docs)
  const actorById = new Map(actors.map((actor) => [actor.id, actor]))

  const lines: SealedAuditLineView[] = scoped.map((doc) => {
    const actor = doc.actorId ? actorById.get(doc.actorId) : undefined
    let actorLabel: string | null = null
    if (actor) {
      const name = actor.name ?? actor.email
      actorLabel = name ? `${name} (${actor.role})` : null
    }
    return { id: doc.id, createdAt: doc.createdAt, action: doc.action, actorLabel }
  })

  return { ok: true, lines }
}
