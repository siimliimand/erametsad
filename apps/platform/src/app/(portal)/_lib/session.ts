import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { verifyAccessToken, type AccessTokenPayload } from '@/lib/auth/jwt'
import { getActiveProfileId } from '@/lib/auth/profile-scope'
import { getUserSession } from '@/lib/auth/session'
import type { CoreRepositories } from '@/lib/data/repositories'
import { getRepositories, sessionGuardContext } from '@/lib/data/runtime'
import type { Profile } from '@/lib/data/schema'

/**
 * Server-only session helpers for the (portal) route group. Pages and route
 * handlers read auth state through this module and never touch cookies or
 * JWTs directly.
 */

export interface PortalAuthState {
  userId: string
  role: string
  profileId: string | null
  profileName: string | null
}

export interface PortalSession {
  session: {
    userId: string
    role: string
    sessionId: string
    profileId: string | null
  }
  profile: Profile | null
  repositories: CoreRepositories
}

// Only same-origin paths may travel through ?next=: local absolute form,
// never the protocol-relative //host form (open-redirect vector).
function sameOriginPath(candidate: string | null | undefined): string | null {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return null
  }
  return candidate
}

// Middleware sets no x-pathname today, so server components should pass
// their own path as nextPath. Resolution order: explicit argument, then the
// x-pathname header if middleware gains it later, then the referer path as
// a last-resort fallback (unreliable, hence last).
async function resolveCurrentPath(explicit?: string): Promise<string | null> {
  const passed = sameOriginPath(explicit)
  if (passed) return passed
  const headerList = await headers()
  const fromHeader = sameOriginPath(headerList.get('x-pathname'))
  if (fromHeader) return fromHeader
  const referer = headerList.get('referer')
  if (!referer) return null
  try {
    const url = new URL(referer)
    return sameOriginPath(`${url.pathname}${url.search}`)
  } catch {
    return null
  }
}

async function readAccessToken(): Promise<AccessTokenPayload | null> {
  const token = (await cookies()).get('access_token')?.value
  return token ? verifyAccessToken(token) : null
}

// The JWT alone proves signature only; the D1-backed row is the liveness
// source (revocation, expiry), so every helper re-reads it.
async function loadSessionRecord(
  sessionId: string | null,
): Promise<Awaited<ReturnType<typeof getUserSession>>> {
  return sessionId ? getUserSession(sessionId) : null
}

async function findActiveProfile(
  repositories: CoreRepositories,
  userId: string,
  profileId: string | null,
): Promise<Profile | null> {
  if (!profileId) return null
  const result = await repositories.find({
    collection: 'profile',
    where: { id: { equals: profileId }, user: { equals: userId } },
    limit: 1,
  })
  return result.docs[0] ?? null
}

function profileDisplayName(profile: Profile | null): string | null {
  if (!profile) return null
  if (profile.type === 'company') {
    return profile.companyName ?? profile.displayName
  }
  return profile.displayName ?? profile.companyName
}

/**
 * Guard for every authed portal server component and route handler. When
 * anonymous (no token, bad token, or revoked/expired D1 session), redirects
 * to /login with a validated ?next= so login can return the user.
 */
export async function requirePortalSession(nextPath?: string): Promise<PortalSession> {
  const payload = await readAccessToken()
  const sessionId = payload?.sessionId ?? null
  const sessionRecord = await loadSessionRecord(sessionId)
  if (!payload || !sessionId || !sessionRecord) {
    const current = await resolveCurrentPath(nextPath)
    redirect(current ? `/login?next=${encodeURIComponent(current)}` : '/login')
  }
  const repositories = await getRepositories(sessionGuardContext(payload))
  const profileId = getActiveProfileId({ profileId: sessionRecord.profileId ?? null })
  const profile = await findActiveProfile(repositories, payload.userId, profileId)
  return {
    session: {
      userId: payload.userId,
      role: payload.role,
      sessionId,
      profileId,
    },
    profile,
    repositories,
  }
}

/** Non-redirecting auth state for header chips and conditionals; null when anonymous. */
export async function getPortalAuthState(): Promise<PortalAuthState | null> {
  const payload = await readAccessToken()
  const sessionId = payload?.sessionId ?? null
  const sessionRecord = await loadSessionRecord(sessionId)
  if (!payload || !sessionRecord) return null
  const profileId = getActiveProfileId({ profileId: sessionRecord.profileId ?? null })
  let profileName: string | null = null
  if (profileId) {
    const repositories = await getRepositories(sessionGuardContext(payload))
    profileName = profileDisplayName(
      await findActiveProfile(repositories, payload.userId, profileId),
    )
  }
  return { userId: payload.userId, role: payload.role, profileId, profileName }
}

/** Active profile for the current session; null when anonymous or none selected. */
export async function getActiveProfile(): Promise<Profile | null> {
  const payload = await readAccessToken()
  const sessionId = payload?.sessionId ?? null
  const sessionRecord = await loadSessionRecord(sessionId)
  if (!payload || !sessionRecord) return null
  const repositories = await getRepositories(sessionGuardContext(payload))
  return findActiveProfile(
    repositories,
    payload.userId,
    getActiveProfileId({ profileId: sessionRecord.profileId ?? null }),
  )
}
