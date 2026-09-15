import type { Metadata } from 'next'

import { ObjectWizard } from './_components/ObjectWizard'
import { requirePortalSession } from '../../../_lib/session'
import { UserPageHead } from '../../_components/UserPageHead'

import { getRepositories } from '@/lib/data/runtime'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Paku oma objekti',
}

// Users are admin-only under the access guard, so the caller's own email is
// read as system context scoped by the verified session user id — the same
// pattern the profile page uses.
function readEmail(user: unknown): string | null {
  const record = (user ?? {}) as Record<string, unknown>
  const email = record.email
  return typeof email === 'string' && email.trim() !== '' ? email : null
}

function profileName(profile: {
  type: string
  companyName: string | null
  displayName: string | null
}): string | null {
  return profile.type === 'company'
    ? (profile.companyName ?? profile.displayName)
    : (profile.displayName ?? profile.companyName)
}

export default async function ObjectSubmissionWizardPage() {
  const { session, profile } = await requirePortalSession('/user/objects/paku')
  const systemRepos = await getRepositories()
  const user = await systemRepos.findByID({
    collection: 'users',
    id: session.userId,
  })

  return (
    <>
      <UserPageHead
        title="Paku oma objekti"
        summary="Viige objekt samm-sammult müüki või tellige teenus — kava, hooldusraie või istutamine."
      />
      <section className="px-md py-lg md:px-lg">
        <ObjectWizard
          contactPrefill={{
            name: profile ? profileName(profile) : null,
            email: readEmail(user),
            phone: profile?.phone ?? null,
          }}
          onSubmit={() => {
            // Submission wiring lands with task 3.3.
          }}
        />
      </section>
    </>
  )
}
