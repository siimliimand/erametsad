import type { Metadata } from 'next'

import { UserPageHead } from '../_components/UserPageHead'
import { ProfileDashboard } from './_components/ProfileDashboard'
import type { ProfileView, UserAccount } from './_components/types'

import { requirePortalSession } from '@/app/(portal)/_lib/session'
import type { ProfileDoc } from '@/lib/data/repositories/registry'
import { getRepositories } from '@/lib/data/runtime'

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
    companyName:
      profile.type === 'company' ? (profile.companyName ?? null) : null,
    companyRegCode:
      profile.type === 'company' ? (profile.companyRegCode ?? null) : null,
  }
}

// Users are admin-only under the access guard, so the caller's own identity
// row (name, email, isikukood, authMethod) is read as system context, scoped
// by the verified session user id — the same pattern the change-password
// route uses. Masking happens in the card; the value travels as before.
function readAccount(user: unknown): UserAccount {
  const record = (user ?? {}) as Record<string, unknown>
  const isikukood =
    typeof record.isikukood === 'string' && record.isikukood.trim() !== ''
      ? record.isikukood
      : null
  const name =
    typeof record.name === 'string' && record.name.trim() !== ''
      ? record.name
      : null
  const email =
    typeof record.email === 'string' && record.email.trim() !== ''
      ? record.email
      : null
  return {
    isikukood,
    eidVerified: record.authMethod === 'eid',
    authMethod: record.authMethod === 'eid' ? 'eid' : 'password',
    name,
    email,
  }
}

export default async function UserProfilePage() {
  const { session, repositories } = await requirePortalSession('/user/profile')

  const { docs } = await repositories.find({ collection: 'profile' })
  const systemRepos = await getRepositories()
  const user = await systemRepos.findByID({
    collection: 'users',
    id: session.userId,
  })

  return (
    <>
      <UserPageHead
        title="Minu profiil"
        summary="Kontaktandmed, profiilid ja pakkumisõigused — ning konto turvalisus ja andmehaldus ühes kohas."
      />
      {/* Demo .profile-wrap: single 880px column of stacked cards. */}
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6 pb-16 pt-8">
        <ProfileDashboard
          initialProfiles={docs.map(toProfileView)}
          account={readAccount(user)}
          activeProfileId={session.profileId}
        />
      </div>
    </>
  )
}
