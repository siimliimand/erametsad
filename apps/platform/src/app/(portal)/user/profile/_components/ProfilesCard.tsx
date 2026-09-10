'use client'

import { Btn } from '@erametsad/ui'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { ProfileCardShell } from './ProfileCardShell'
import { ApiError, requestJson } from './api'
import { pillActive, pillInfo } from './pills'
import type { ApprovalStatusView, ProfileView, UserAccount } from './types'

interface ProfilesCardProps {
  profiles: ProfileView[]
  account: UserAccount
  activeId: string | null
  selectingId: string | null
  selectError: string | null
  onSelect: (id: string) => void
}

interface RegistryCompany {
  name: string
  regCode: string
  boardMembers: { name: string; role: string }[]
}

const approvalLabels: Record<ApprovalStatusView, string> = {
  pending: 'Kasutusaotlus ootel',
  approved: 'Kinnitatud',
  rejected: 'Keeldutud',
}

const approvalPillClass: Record<ApprovalStatusView, string> = {
  pending: pillInfo,
  approved: pillActive,
  rejected: pillInfo,
}

const profileFlag =
  'text-[12px] font-semibold uppercase tracking-wider text-inkMuted'

export function ProfilesCard({
  profiles,
  account,
  activeId,
  selectingId,
  selectError,
  onSelect,
}: ProfilesCardProps) {
  const [lookup, setLookup] = useState<RegistryCompany | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const privateProfile = profiles.find((profile) => profile.type === 'private')
  const companyProfile = profiles.find((profile) => profile.type === 'company')

  // GET /api/v1/company-lookup only reads the registry; the profiles PATCH
  // allowlist has no company fields, so a fresh lookup can never be written
  // back to the profile. The result is therefore display-only.
  async function relookup() {
    if (!companyProfile?.companyRegCode) return
    setBusy(true)
    setError(null)
    setNotFound(false)
    try {
      const data = await requestJson<{
        found: boolean
        company?: RegistryCompany
      }>(
        `/api/v1/company-lookup?regCode=${encodeURIComponent(companyProfile.companyRegCode)}`,
      )
      if (data.found && data.company) {
        setLookup(data.company)
      } else {
        setNotFound(true)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true)
      } else {
        setError(
          err instanceof Error ? err.message : 'Registri päring ebaõnnestus.',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfileCardShell
      labelledBy="profile-profiles-heading"
      title="Profiilid"
      subtitle="Aktiivne profiil määrab, millised andmed ja õigused oksjonitel kasutusel on."
    >
      {profiles.length === 0 ? (
        <p className="text-bodySm text-inkMuted">
          Profiili ei leitud. Loo konto läbi registreerimise.
        </p>
      ) : (
        <div className="flex flex-col">
          {privateProfile && (
            <div className="flex flex-wrap items-center gap-sm border-b border-border py-3.5">
              <div className="min-w-0 flex-1 basis-[240px]">
                <p className={profileFlag}>Eraisik</p>
                <p className="m-0 font-semibold text-ink">
                  {privateProfile.displayName ?? account.name ?? 'Eraisik'}
                </p>
                <p className="m-0 mt-0.5 text-bodySm text-inkMuted">
                  {account.email ?? '—'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {privateProfile.id === activeId && (
                  <span className={pillActive}>Aktiivne profiil</span>
                )}
                {privateProfile.id !== activeId && (
                  <Btn
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={selectingId === privateProfile.id}
                    onClick={() => {
                      onSelect(privateProfile.id)
                    }}
                  >
                    Võta kasutusele
                  </Btn>
                )}
              </div>
            </div>
          )}

          {companyProfile && (
            <div
              className={
                privateProfile
                  ? 'border-b border-border py-3.5'
                  : 'border-b-0 py-3.5'
              }
            >
              <div className="flex flex-wrap items-center gap-sm">
                <div className="min-w-0 flex-1 basis-[240px]">
                  <p className={profileFlag}>Ettevõte</p>
                  <p className="m-0 font-semibold text-ink">
                    {companyProfile.companyName ?? 'Ettevõte'}
                  </p>
                  <p className="m-0 mt-0.5 text-bodySm text-inkMuted">
                    Registrikood{' '}
                    <span className="font-mono font-semibold text-ink">
                      {companyProfile.companyRegCode ?? '—'}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {companyProfile.id === activeId && (
                    <span className={pillActive}>Aktiivne profiil</span>
                  )}
                  <span
                    className={approvalPillClass[companyProfile.approvalStatus]}
                  >
                    {approvalLabels[companyProfile.approvalStatus]}
                  </span>
                  {companyProfile.id !== activeId && (
                    <Btn
                      variant="ghost"
                      size="sm"
                      type="button"
                      disabled={selectingId === companyProfile.id}
                      onClick={() => {
                        onSelect(companyProfile.id)
                      }}
                    >
                      Võta kasutusele
                    </Btn>
                  )}
                  <Btn
                    variant="ghost"
                    size="sm"
                    type="button"
                    isLoading={busy}
                    onClick={() => {
                      void relookup()
                    }}
                  >
                    Kontrolli registris
                  </Btn>
                </div>
              </div>

              {notFound && (
                <p role="alert" className="mt-2 text-bodySm text-danger">
                  Ettevõtet registrist ei leitud.
                </p>
              )}
              {error && (
                <p role="alert" className="mt-2 text-bodySm text-danger">
                  {error}
                </p>
              )}
              {lookup && (
                <div className="mt-2 flex flex-col gap-1.5 rounded-input bg-bgMist px-sm py-xs">
                  <p className="m-0 text-bodySm font-semibold text-ink">
                    {lookup.name}
                  </p>
                  {lookup.boardMembers.length > 0 && (
                    <ul className="m-0 flex list-none flex-col gap-1 p-0">
                      {lookup.boardMembers.map((member) => (
                        <li
                          key={member.name}
                          className="text-bodySm text-inkMuted"
                        >
                          {member.name} – {member.role}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="m-0 text-bodySm text-inkMuted">
                    Päring kuvab registri hetkeolukorda ega uuenda profiili
                    andmeid.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectError && (
        <p role="alert" className="text-bodySm text-danger">
          {selectError}
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2.5">
        <Link
          href="/register"
          className="inline-flex h-8 items-center justify-center gap-2 rounded-button border border-primary bg-transparent px-3 font-label text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight hover:text-primaryHover motion-reduce:transition-none"
        >
          <Plus size={16} aria-hidden="true" />
          Lisa ettevõte
        </Link>
      </div>
    </ProfileCardShell>
  )
}
