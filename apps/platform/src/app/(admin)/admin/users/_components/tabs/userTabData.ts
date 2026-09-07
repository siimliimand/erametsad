'use server'

import { requireAdminRepositories } from '../../../../_lib/admin'
import { can } from '../../../../_lib/permissions'

import { fetchUserTabPayload } from './userTabQueries'
import type { UserTabResult } from './userTabQueries'
import type { DataTabId } from './userTabs'

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
