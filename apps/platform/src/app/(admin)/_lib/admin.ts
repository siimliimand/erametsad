import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { verifyAdminAccessToken } from '@/lib/auth/jwt'
import type { CoreRepositories } from '@/lib/data/repositories'
import { getRepositories, sessionGuardContext } from '@/lib/data/runtime'

export interface AdminSession {
  userId: string
  role: string
}

/**
 * Guard for every admin server component and server action: verifies the
 * access-token cookie against users.role (admin/superadmin) and returns
 * repositories bound to that user's guard context. Non-admins are sent to
 * the login page.
 */
export async function requireAdminRepositories(): Promise<{
  session: AdminSession
  repositories: CoreRepositories
}> {
  const token = (await cookies()).get('access_token')?.value
  const payload = token ? verifyAdminAccessToken(token) : null
  if (!payload) {
    redirect('/login')
  }
  const repositories = await getRepositories(sessionGuardContext(payload))
  return { session: { userId: payload.userId, role: payload.role }, repositories }
}
