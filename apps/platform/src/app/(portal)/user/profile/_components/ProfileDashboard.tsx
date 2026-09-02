'use client'

import { Btn } from '@erametsad/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

import { CompanyProfileCard } from './CompanyProfileCard'
import { ConsentsLog } from './ConsentsLog'
import { PasswordModal } from './PasswordModal'
import { PrivateProfileCard } from './PrivateProfileCard'
import { RightsMatrix } from './RightsMatrix'
import { SessionsList } from './SessionsList'
import { requestJson } from './api'
import type { ProfileView, UserIdentity } from './types'

interface ProfileDashboardProps {
  initialProfiles: ProfileView[]
  identity: UserIdentity
  activeProfileId: string | null
}

export function ProfileDashboard({
  initialProfiles,
  identity,
  activeProfileId,
}: ProfileDashboardProps) {
  const router = useRouter()
  const [profiles, setProfiles] = useState(initialProfiles)
  const [activeId, setActiveId] = useState(activeProfileId)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [selectError, setSelectError] = useState<string | null>(null)

  const handleSaved = useCallback((updated: ProfileView[]) => {
    setProfiles(updated)
  }, [])

  async function handleSelect(id: string) {
    setSelectingId(id)
    setSelectError(null)
    try {
      await requestJson(`/api/v1/profiles/${encodeURIComponent(id)}/select`, { method: 'POST' })
      setActiveId(id)
      router.refresh()
    } catch (error) {
      setSelectError(
        error instanceof Error ? error.message : 'Profiili vahetamine ebaõnnestus.',
      )
    } finally {
      setSelectingId(null)
    }
  }

  const privateProfile = profiles.find((profile) => profile.type === 'private')
  const companyProfile = profiles.find((profile) => profile.type === 'company')
  const consentsSource = privateProfile ?? companyProfile ?? null

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="font-heading text-h3 text-ink">Minu profiil</h1>
        <p className="mt-2xs text-bodySm text-inkMuted">
          Profiili andmed, pakkujaõigused, turvalisus ja nõusolekud.
        </p>
      </div>

      <section aria-labelledby="profiles-heading" className="flex flex-col gap-sm">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="profiles-heading" className="font-heading text-h4 text-ink">
            Profiilid
          </h2>
          <Link
            href="/register"
            className="text-label font-semibold text-primary underline-offset-2 hover:underline"
          >
            Lisa ettevõte registreerimise teel
          </Link>
        </div>
        {profiles.length === 0 ? (
          <p className="rounded-card border border-border bg-bgPage p-md text-bodySm text-inkMuted">
            Profiili ei leitud. Loo konto läbi registreerimise.
          </p>
        ) : (
          <div className="grid gap-sm md:grid-cols-2">
            {privateProfile && (
              <PrivateProfileCard
                profile={privateProfile}
                identity={identity}
                isActive={privateProfile.id === activeId}
                isBusy={selectingId === privateProfile.id}
                onSelect={(id) => {
                  void handleSelect(id)
                }}
                onSaved={handleSaved}
              />
            )}
            {companyProfile && (
              <CompanyProfileCard
                profile={companyProfile}
                isActive={companyProfile.id === activeId}
                isBusy={selectingId === companyProfile.id}
                onSelect={(id) => {
                  void handleSelect(id)
                }}
              />
            )}
          </div>
        )}
        {selectError && (
          <p role="alert" className="text-bodySm text-danger">
            {selectError}
          </p>
        )}
      </section>

      <RightsMatrix />

      <section aria-labelledby="security-heading" className="flex flex-col gap-sm">
        <h2 id="security-heading" className="font-heading text-h4 text-ink">
          Parool ja sessioonid
        </h2>
        <div className="flex flex-col gap-sm rounded-card border border-border bg-bgPage p-md shadow-card">
          <div className="flex flex-col gap-xs sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-bodySm font-semibold text-ink">Parool</p>
              <p className="text-bodySm text-inkMuted">
                Pärast parooli vahetamist logitakse kõik seadmed välja.
              </p>
            </div>
            <Btn
              variant="outline"
              size="sm"
              onClick={() => {
                setPasswordOpen(true)
              }}
            >
              Muuda parooli
            </Btn>
          </div>
          <SessionsList />
        </div>
      </section>

      {consentsSource && <ConsentsLog profile={consentsSource} onChanged={handleSaved} />}

      <PasswordModal
        isOpen={passwordOpen}
        onClose={() => {
          setPasswordOpen(false)
        }}
      />
    </div>
  )
}
