import type { Metadata } from 'next'

import { ProfileDashboard } from './_components/ProfileDashboard'
import type { ProfileView, UserIdentity } from './_components/types'

import { requirePortalSession } from '@/app/(portal)/_lib/session'
import { getRepositories } from '@/lib/data/runtime'
import type { ProfileDoc } from '@/lib/data/repositories/registry'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Minu profiil',
}

function toProfileView(profile: ProfileDoc): ProfileView {
  return {
    id: profile.id,
    type: profile.type,
    displayName: profile.displayName,
    phone: profile.phone,
    approvalStatus: profile.approvalStatus,
    termsConsentAt: profile.termsConsentAt,
    privacyConsentAt: profile.privacyConsentAt,
    marketingConsentAt: profile.marketingConsentAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    companyName: profile.type === 'company' ? (profile.companyName ?? null) : null,
    companyRegCode: profile.type === 'company' ? (profile.companyRegCode ?? null) : null,
  }
}

// Users are admin-only under the access guard, so the caller's own identity
// row (isikukood, authMethod) is read as system context, scoped by the
// verified session user id — the same pattern the change-password route uses.
function readIdentity(user: unknown): UserIdentity {
  const record = (user ?? {}) as Record<string, unknown>
  const isikukood =
    typeof record.isikukood === 'string' && record.isikukood.trim() !== ''
      ? record.isikukood
      : null
  return { isikukood, eidVerified: record.authMethod === 'eid' }
}

export default async function UserProfilePage() {
  const { session, repositories } = await requirePortalSession('/user/profile')

  const { docs } = await repositories.find({ collection: 'profile' })
  const systemRepos = await getRepositories()
  const user = await systemRepos.findByID({ collection: 'users', id: session.userId })

  return (
    <ProfileDashboard
      initialProfiles={docs.map(toProfileView)}
      identity={readIdentity(user)}
      activeProfileId={session.profileId}
    />
  )
}
