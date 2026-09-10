'use client'

import { Btn } from '@erametsad/ui'
import {
  CircleCheck,
  KeyRound,
  Lock,
  ScrollText,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState, type ReactNode, type SyntheticEvent } from 'react'

import { ProfileCardShell } from './ProfileCardShell'
import { requestJson } from './api'
import { maskIsikukood } from './format'
import type { ProfileView, UserAccount } from './types'

interface DataCardProps {
  account: UserAccount
  /** Profile whose contact fields the card edits (active, else first). */
  profile: ProfileView | null
  onSaved: (profiles: ProfileView[]) => void
}

const chipNote =
  'inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-pill bg-bgMist px-2.5 py-0.5 text-[12px] font-semibold text-inkMuted'

const authChip =
  'inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-pill bg-primaryLight px-3 py-0.5 text-bodySm font-semibold text-primaryDark'

const auditNote =
  'inline-flex items-center gap-1.5 text-bodySm font-normal text-inkMuted'

const fieldHint = 'text-bodySm font-normal text-inkMuted'

const readOnlyValue =
  'min-w-0 flex-1 truncate rounded-button border border-transparent bg-transparent px-0 py-2 font-medium text-ink'

const editInput =
  'h-10 w-full min-w-0 rounded-button border border-border bg-bgPage px-3 font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

function DataRow({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-1 border-b border-border py-3 last:border-b-0 md:grid-cols-[170px_minmax(0,1fr)] md:gap-4">
      <dt className="text-bodySm font-semibold text-inkMuted">
        {htmlFor !== undefined ? (
          <label htmlFor={htmlFor}>{label}</label>
        ) : (
          label
        )}
      </dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-2 font-medium text-ink">
        {children}
      </dd>
    </div>
  )
}

export function DataCard({ account, profile, onSaved }: DataCardProps) {
  const [revealed, setRevealed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDisplayName(profile?.displayName ?? '')
    setPhone(profile?.phone ?? '')
  }, [profile])

  const maskedCode =
    account.isikukood !== null ? maskIsikukood(account.isikukood) : null

  function toggleReveal() {
    setRevealed((open) => !open)
  }

  function startEdit() {
    setDisplayName(profile?.displayName ?? '')
    setPhone(profile?.phone ?? '')
    setSaved(false)
    setError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setError(null)
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const data = await requestJson<{ profiles: ProfileView[] }>(
        '/api/v1/profiles',
        {
          method: 'PATCH',
          body: JSON.stringify({
            displayName: displayName.trim() || null,
            phone: phone.trim() || null,
          }),
        },
      )
      onSaved(data.profiles)
      setSaved(true)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvestamine ebaõnnestus.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfileCardShell
      labelledBy="profile-data-heading"
      title="Andmed"
      subtitle="Sinu isiku- ja kontaktandmed."
      aside={
        <span className={authChip} title="Sisselogimise meetod">
          {account.authMethod === 'eid' ? (
            <ShieldCheck size={12} aria-hidden="true" />
          ) : (
            <KeyRound size={12} aria-hidden="true" />
          )}
          {account.authMethod === 'eid' ? 'eID' : 'Parool'}
        </span>
      }
    >
      <form
        onSubmit={(event) => {
          void handleSubmit(event)
        }}
        className="flex flex-col"
        noValidate
      >
        <dl className="m-0">
          <DataRow label="Nimi" htmlFor="profile-name">
            {editing ? (
              <input
                id="profile-name"
                name="displayName"
                type="text"
                autoComplete="name"
                maxLength={120}
                value={displayName}
                disabled={busy}
                onChange={(event) => {
                  setDisplayName(event.target.value)
                }}
                className={editInput}
              />
            ) : (
              <span className={readOnlyValue}>
                {profile?.displayName ?? account.name ?? '—'}
              </span>
            )}
          </DataRow>

          <DataRow label="Isikukood">
            {account.isikukood === null ? (
              <span className={readOnlyValue}>—</span>
            ) : (
              <>
                <span className="font-mono text-bodySm font-semibold text-ink">
                  {revealed ? account.isikukood : maskedCode}
                </span>
                <Btn
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={toggleReveal}
                  aria-pressed={revealed}
                  title={
                    revealed
                      ? 'Peida isikukood'
                      : 'Näita isikukoodi (vaatamine logitakse auditisse)'
                  }
                >
                  {revealed ? 'Peida' : 'Näita'}
                </Btn>
                <span className={auditNote}>
                  <ScrollText size={12} aria-hidden="true" />
                  {revealed
                    ? 'Vaatamine logitud auditisse'
                    : 'Vaatamine logitakse auditisse'}
                </span>
              </>
            )}
            {account.eidVerified && (
              <span className={chipNote}>
                <Lock size={11} aria-hidden="true" />
                kinnitatud eID-iga
              </span>
            )}
          </DataRow>

          <DataRow label="E-post" htmlFor="profile-email">
            <input
              id="profile-email"
              type="email"
              autoComplete="email"
              value={account.email ?? '—'}
              disabled
              readOnly
              className={readOnlyValue}
            />
            {account.email !== null && (
              <span className={chipNote}>
                <CircleCheck size={11} aria-hidden="true" />
                kinnitatud
              </span>
            )}
          </DataRow>

          <DataRow label="Telefon" htmlFor="profile-phone">
            {editing ? (
              <input
                id="profile-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={32}
                value={phone}
                disabled={busy}
                onChange={(event) => {
                  setPhone(event.target.value)
                }}
                className={editInput}
              />
            ) : (
              <span className={readOnlyValue}>{profile?.phone ?? '—'}</span>
            )}
            <span className={fieldHint}>kinnita SMS-koodiga</span>
          </DataRow>
        </dl>

        {error && (
          <p role="alert" className="text-bodySm text-danger">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2.5">
          {editing ? (
            <>
              <Btn
                variant="ghost"
                size="sm"
                type="button"
                onClick={cancelEdit}
                disabled={busy}
              >
                Loobu
              </Btn>
              <Btn variant="primary" size="sm" type="submit" isLoading={busy}>
                Salvesta muudatused
              </Btn>
            </>
          ) : (
            profile !== null && (
              <>
                {saved && (
                  <span
                    role="status"
                    className="self-center text-bodySm text-primary"
                  >
                    Salvestatud
                  </span>
                )}
                <Btn
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={startEdit}
                >
                  Muuda kontaktandmeid
                </Btn>
              </>
            )
          )}
        </div>
      </form>
    </ProfileCardShell>
  )
}
