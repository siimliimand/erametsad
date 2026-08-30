'use client'

import { Btn } from '@eametsad/ui'
import { useState } from 'react'

import { ApiError, requestJson } from './api'
import { pillActive, pillInfo } from './pills'
import type { ApprovalStatusView, ProfileView } from './types'

interface CompanyProfileCardProps {
  profile: ProfileView
  isActive: boolean
  isBusy: boolean
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

export function CompanyProfileCard({
  profile,
  isActive,
  isBusy,
  onSelect,
}: CompanyProfileCardProps) {
  const [lookup, setLookup] = useState<RegistryCompany | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // GET /api/v1/company-lookup only reads the registry; the profiles PATCH
  // allowlist has no company fields, so a fresh lookup can never be written
  // back to the profile. The result is therefore display-only.
  async function relookup() {
    if (!profile.companyRegCode) return
    setBusy(true)
    setError(null)
    setNotFound(false)
    try {
      const data = await requestJson<{ found: boolean; company?: RegistryCompany }>(
        `/api/v1/company-lookup?regCode=${encodeURIComponent(profile.companyRegCode)}`,
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
        setError(err instanceof Error ? err.message : 'Registri päring ebaõnnestus.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="flex flex-col gap-sm rounded-card border border-border bg-bgPage p-md shadow-card">
      <header className="flex items-center justify-between gap-sm">
        <h3 className="font-heading text-h4 text-ink">Ettevõte</h3>
        {isActive ? (
          <span className={pillActive}>Aktiivne profiil</span>
        ) : (
          <Btn
            variant="ghost"
            size="sm"
            disabled={isBusy}
            onClick={() => {
              onSelect(profile.id)
            }}
          >
            Võta kasutusele
          </Btn>
        )}
      </header>

      <span className={`w-fit ${approvalPillClass[profile.approvalStatus]}`}>
        {approvalLabels[profile.approvalStatus]}
      </span>

      <div className="flex flex-col gap-2xs rounded-input bg-bgMist px-sm py-xs">
        <div className="flex items-baseline justify-between gap-sm">
          <p className="text-label text-inkMuted">Nimi</p>
          <p className="text-bodySm font-semibold text-ink">{profile.companyName ?? '—'}</p>
        </div>
        <div className="flex items-baseline justify-between gap-sm">
          <p className="text-label text-inkMuted">Registrikood</p>
          <p className="font-mono text-bodySm font-semibold text-ink">
            {profile.companyRegCode ?? '—'}
          </p>
        </div>
        <p className="text-label text-inkMuted">
          Registrikood on registrist kinnitatud ja ei ole muudetav.
        </p>
      </div>

      <div>
        <Btn
          variant="outline"
          size="sm"
          isLoading={busy}
          onClick={() => {
            void relookup()
          }}
        >
          Kontrolli registris
        </Btn>
        {notFound && (
          <p role="alert" className="mt-2xs text-bodySm text-danger">
            Ettevõtet registrist ei leitud.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2xs text-bodySm text-danger">
            {error}
          </p>
        )}
      </div>

      {lookup && (
        <div className="flex flex-col gap-2xs rounded-input bg-bgMist px-sm py-xs">
          <p className="text-bodySm font-semibold text-ink">{lookup.name}</p>
          {lookup.boardMembers.length > 0 && (
            <ul className="flex flex-col gap-2xs">
              {lookup.boardMembers.map((member) => (
                <li key={member.name} className="text-bodySm text-inkMuted">
                  {member.name} – {member.role}
                </li>
              ))}
            </ul>
          )}
          <p className="text-label text-inkMuted">
            Päring kuvab registri hetkeolukorda ega uuenda profiili andmeid.
          </p>
        </div>
      )}
    </article>
  )
}
