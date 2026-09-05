import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { isStaffRole, type StaffRole } from './permissions'

import { verifyAccessToken } from '@/lib/auth/jwt'
import type { CoreRepositories } from '@/lib/data/repositories'
import { getRepositories, sessionGuardContext } from '@/lib/data/runtime'

export interface AdminSession {
  userId: string
  role: StaffRole
}

/**
 * Guard for every admin server component and server action: verifies the
 * access-token cookie against users.role (staff roles only) and returns
 * repositories bound to that user's guard context. Anyone without a staff
 * role is sent to the login page. Scoping and per-action permissions live
 * in ./permissions; this guard alone never authorizes a write.
 */
export async function requireAdminRepositories(): Promise<{
  session: AdminSession
  repositories: CoreRepositories
}> {
  const token = (await cookies()).get('access_token')?.value
  const payload = token ? verifyAccessToken(token) : null
  if (!payload || !isStaffRole(payload.role)) {
    redirect('/login')
  }
  const repositories = await getRepositories(sessionGuardContext(payload))
  return { session: { userId: payload.userId, role: payload.role }, repositories }
}
