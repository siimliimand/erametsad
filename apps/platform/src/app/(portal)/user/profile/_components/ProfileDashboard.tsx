'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

import { DataCard } from './DataCard'
import { PrivacyCard } from './PrivacyCard'
import { ProfilesCard } from './ProfilesCard'
import { RightsChips } from './RightsChips'
import { SecurityCard } from './SecurityCard'
import { requestJson } from './api'
import type { ProfileView, UserAccount } from './types'

interface ProfileDashboardProps {
  initialProfiles: ProfileView[]
  account: UserAccount
  activeProfileId: string | null
}

// Demo 12-user-profile: five stacked cards inside the 880px column.
export function ProfileDashboard({
  initialProfiles,
  account,
  activeProfileId,
}: ProfileDashboardProps) {
  const router = useRouter()
  const [profiles, setProfiles] = useState(initialProfiles)
  const [activeId, setActiveId] = useState(activeProfileId)
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [selectError, setSelectError] = useState<string | null>(null)

  const handleSaved = useCallback((updated: ProfileView[]) => {
    setProfiles(updated)
  }, [])

  async function handleSelect(id: string) {
    setSelectingId(id)
    setSelectError(null)
    try {
      await requestJson(`/api/v1/profiles/${encodeURIComponent(id)}/select`, {
        method: 'POST',
      })
      setActiveId(id)
      router.refresh()
    } catch (error) {
      setSelectError(
        error instanceof Error
          ? error.message
          : 'Profiili vahetamine ebaõnnestus.',
      )
    } finally {
      setSelectingId(null)
    }
  }

  const privateProfile = profiles.find((profile) => profile.type === 'private')
  const companyProfile = profiles.find((profile) => profile.type === 'company')
  const contactProfile =
    profiles.find((profile) => profile.id === activeId) ??
    privateProfile ??
    companyProfile ??
    null
  const consentsSource = privateProfile ?? companyProfile ?? null

  return (
    <div className="flex flex-col gap-6">
      <DataCard
        account={account}
        profile={contactProfile}
        onSaved={handleSaved}
      />

      <ProfilesCard
        profiles={profiles}
        account={account}
        activeId={activeId}
        selectingId={selectingId}
        selectError={selectError}
        onSelect={(id) => {
          void handleSelect(id)
        }}
      />

      <RightsChips />

      <SecurityCard account={account} />

      <PrivacyCard profile={consentsSource} onChanged={handleSaved} />
    </div>
  )
}
