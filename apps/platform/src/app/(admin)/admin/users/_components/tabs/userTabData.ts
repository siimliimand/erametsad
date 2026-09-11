'use server'


import { fetchUserTabPayload } from './userTabQueries'
import type { UserTabResult } from './userTabQueries'
import { SHILL_FLAG_AUDIT_ACTION } from '../user-search'
import type { DataTabId } from './userTabs'
import { requireAdminRepositories } from '../../../../_lib/admin'
import { can, isStaffRole } from '../../../../_lib/permissions'

/**
 * Drawer data loader: same fetch path as the detail page (fetchUserTabPayload),
 * guarded server-side. The list host only knows the table row, so tab content
 * loads per open/tab switch instead of preloading every row.
 */
export async function loadUserTabData(userId: string, tab: DataTabId): Promise<UserTabResult> {
  const { session, repositories } = await requireAdminRepositories()
  if (!can(session.role, 'users:read')) {
    throw new Error('Kasutaja detaili vaatamise õigus puudub.')
  }
  const payload = await fetchUserTabPayload(repositories, userId, tab)
  if (payload === null) {
    throw new Error('Kasutajat ei leitud.')
  }
  return { canWrite: can(session.role, 'users:write'), payload }
}

export interface UserActionState {
  canWrite: boolean
  /** Staff targets reject impersonation and ban server-side. */
  staffTarget: boolean
  /** Durable ban marker exists (append-only user.ban audit entry). */
  banned: boolean
  /** Active shill flag exists (latest user.shill_flag phase is 'flagged'). */
  flagged: boolean
  status: 'active' | 'suspended' | 'deleted'
}

/**
 * Drawer action context for the footer controls (impersonate, ban, shill
 * flag): loaded per open so the list row alone never decides what the
 * operator may do. The ban check runs only for suspended users, the only
 * state a ban leaves.
 */
export async function loadUserActionState(userId: string): Promise<UserActionState> {
  const { session, repositories } = await requireAdminRepositories()
  if (!can(session.role, 'users:read')) {
    throw new Error('Kasutaja detaili vaatamise õigus puudub.')
  }
  const user = await repositories.findByID({ collection: 'users', id: userId })
  if (!user) {
    throw new Error('Kasutajat ei leitud.')
  }
  let banned = false
  if (user.status === 'suspended') {
    const { docs } = await repositories.find({
      collection: 'audit-entry',
      where: {
        and: [
          { entityType: { equals: 'user' } },
          { entityId: { equals: userId } },
          { action: { equals: 'user.ban' } },
        ],
      },
      limit: 1,
    })
    banned = docs.length > 0
  }
  const { docs: flagEntries } = await repositories.find({
    collection: 'audit-entry',
    where: {
      and: [
        { entityType: { equals: 'user' } },
        { entityId: { equals: userId } },
        { action: { equals: SHILL_FLAG_AUDIT_ACTION } },
      ],
    },
    sort: '-createdAt',
    limit: 1,
  })
  const latestFlag = flagEntries[0]
  const flagPhase = auditFlagPhase(latestFlag?.after)
  return {
    canWrite: can(session.role, 'users:write'),
    staffTarget: isStaffRole(user.role),
    banned,
    flagged: flagPhase !== 'cleared',
    status: user.status,
  }
}

function auditFlagPhase(after: unknown): 'flagged' | 'cleared' | null {
  if (typeof after === 'object' && after !== null && !Array.isArray(after)) {
    const phase = (after as Record<string, unknown>).phase
    return phase === 'cleared' ? 'cleared' : phase === 'flagged' ? 'flagged' : null
  }
  return null
}
