import { BidsTab } from './BidsTab'
import { ContractsTab } from './ContractsTab'
import { IdentityTab } from './IdentityTab'
import { NotificationsTab } from './NotificationsTab'
import { ProfilesTab } from './ProfilesTab'
import { RightsTab } from './RightsTab'

import type { UserTabPayload } from './userTabQueries'

// The one renderer both hosts share: the detail page and the list drawer
// render identical panels from the same payload and canWrite flag.
export function UserTabPanel({
  payload,
  canWrite,
}: {
  payload: UserTabPayload
  canWrite: boolean
}) {
  switch (payload.tab) {
    case 'identiteet':
      return (
        <IdentityTab
          user={payload.user}
          sessions={payload.sessions}
          suspension={payload.suspension}
          canWrite={canWrite}
        />
      )
    case 'profiilid':
      return <ProfilesTab profiles={payload.profiles} />
    case 'oigused':
      return (
        <RightsTab
          userId={payload.userId}
          rights={payload.rights}
          granterNames={payload.granterNames}
          auditEntries={payload.auditEntries}
          canWrite={canWrite}
        />
      )
    case 'lepingud':
      return <ContractsTab rows={payload.contracts} />
    case 'pakkumised':
      return <BidsTab rows={payload.bids} />
    case 'teavitused':
      return <NotificationsTab rows={payload.notifications} />
  }
}
