'use server'

import type { DetectedAnomaly } from './_lib/anomalies'
import { requireAdminRepositories } from '../../../../_lib/admin'

/**
 * Audited internal-review flag from the monitor anomalies panel: one
 * `anomaly.flag` audit entry per flag action, written through the shared
 * repository create (hash chain handled by the repository layer).
 */
export async function flagInternalReviewAction(
  auctionId: string,
  anomalies: readonly DetectedAnomaly[],
): Promise<{ ok: boolean; error: string | null }> {
  if (!Array.isArray(anomalies)) {
    return { ok: false, error: 'Sisejuurdluse märkimine ebaõnnestus.' }
  }
  try {
    const { session, repositories } = await requireAdminRepositories()
    await repositories.create({
      collection: 'audit-entry',
      data: {
        actorId: session.userId,
        action: 'anomaly.flag',
        entityType: 'auction',
        entityId: auctionId,
        after: { anomalies, flaggedAt: new Date().toISOString() },
      },
    })
    return { ok: true, error: null }
  } catch {
    return { ok: false, error: 'Sisejuurdluse märkimine ebaõnnestus.' }
  }
}
