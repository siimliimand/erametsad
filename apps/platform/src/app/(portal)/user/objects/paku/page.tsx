import type { Metadata } from 'next'

import { requirePortalSession } from '../../../_lib/session'
import { UserPageHead } from '../../_components/UserPageHead'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Paku oma objekti',
}

export default async function ObjectSubmissionWizardPage() {
  await requirePortalSession('/user/objects/paku')

  return (
    <>
      <UserPageHead
        title="Paku oma objekti"
        summary="Viige objekt samm-sammult müüki või tellige teenus — kava, hooldusraie või istutamine."
      />
      {/* Wizard client component (task 3.2) mounts inside this container. */}
      <section className="px-md py-lg md:px-lg">
        <p className="text-inkMuted">Pakumise viisard on arendamisel.</p>
      </section>
    </>
  )
}
