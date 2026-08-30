'use client'

import { Btn, FormInput } from '@eametsad/ui'
import { useEffect, useState, type SyntheticEvent } from 'react'

import { requestJson } from './api'
import { pillActive } from './pills'
import type { ProfileView, UserIdentity } from './types'

interface PrivateProfileCardProps {
  profile: ProfileView
  identity: UserIdentity
  isActive: boolean
  isBusy: boolean
  onSelect: (id: string) => void
  onSaved: (profiles: ProfileView[]) => void
}

export function PrivateProfileCard({
  profile,
  identity,
  isActive,
  isBusy,
  onSelect,
  onSaved,
}: PrivateProfileCardProps) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? '')
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDisplayName(profile.displayName ?? '')
    setPhone(profile.phone ?? '')
  }, [profile])

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const data = await requestJson<{ profiles: ProfileView[] }>('/api/v1/profiles', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          phone: phone.trim() || null,
        }),
      })
      onSaved(data.profiles)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvestamine ebaõnnestus.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="flex flex-col gap-sm rounded-card border border-border bg-bgPage p-md shadow-card">
      <header className="flex items-center justify-between gap-sm">
        <h3 className="font-heading text-h4 text-ink">Eraisik</h3>
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

      <div className="flex flex-col gap-2xs rounded-input bg-bgMist px-sm py-xs">
        <p className="text-label text-inkMuted">Isikukood</p>
        <div className="flex items-center gap-xs">
          <span className="font-mono text-bodySm font-semibold text-ink">
            {identity.isikukood ?? '—'}
          </span>
          {identity.eidVerified && <span className={pillActive}>eID kinnitatud</span>}
        </div>
        <p className="text-label text-inkMuted">Isikukoodi ei ole võimalik siin muuta.</p>
      </div>

      <form
        onSubmit={(event) => {
          void handleSubmit(event)
        }}
        className="flex flex-col gap-sm"
        noValidate
      >
        <FormInput
          label="Kuvatav nimi"
          name="displayName"
          value={displayName}
          maxLength={120}
          onChange={(event) => {
            setDisplayName(event.target.value)
          }}
        />
        <FormInput
          label="Telefon"
          name="phone"
          type="tel"
          value={phone}
          maxLength={32}
          onChange={(event) => {
            setPhone(event.target.value)
          }}
        />
        {error && (
          <p role="alert" className="text-bodySm text-danger">
            {error}
          </p>
        )}
        <div className="flex items-center gap-sm">
          <Btn type="submit" size="sm" isLoading={busy}>
            Salvesta
          </Btn>
          {saved && !busy && (
            <span role="status" className="text-bodySm text-primary">
              Salvestatud
            </span>
          )}
        </div>
      </form>
    </article>
  )
}
