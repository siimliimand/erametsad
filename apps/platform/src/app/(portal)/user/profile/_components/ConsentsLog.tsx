'use client'

import { FormCheck } from '@eametsad/ui'
import { useState } from 'react'

import { requestJson } from './api'
import { formatDateTime } from './format'
import { pillMuted } from './pills'
import type { ProfileView } from './types'

interface ConsentsLogProps {
  profile: ProfileView
  onChanged: (profiles: ProfileView[]) => void
}

export function ConsentsLog({ profile, onChanged }: ConsentsLogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const marketingGranted = profile.marketingConsentAt !== null

  // Only the optional consent is toggleable; terms and privacy are locked.
  async function toggleMarketing(next: boolean) {
    setBusy(true)
    setError(null)
    try {
      const data = await requestJson<{ profiles: ProfileView[] }>('/api/v1/profiles', {
        method: 'PATCH',
        body: JSON.stringify({ marketingConsent: next }),
      })
      onChanged(data.profiles)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nõusoleku muutmine ebaõnnestus.')
    } finally {
      setBusy(false)
    }
  }

  const rows = [
    { label: 'Kasutustingimused', at: profile.termsConsentAt, optional: false },
    { label: 'Privaatsuspoliitika', at: profile.privacyConsentAt, optional: false },
    { label: 'Turundusteavitused', at: profile.marketingConsentAt, optional: true },
  ]

  return (
    <section aria-labelledby="consents-heading" className="flex flex-col gap-sm">
      <h2 id="consents-heading" className="font-heading text-h4 text-ink">
        Nõusolekud
      </h2>
      <div className="flex flex-col rounded-card border border-border bg-bgPage p-md shadow-card">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-sm border-b border-border py-xs first:pt-0 last:border-b-0 last:pb-0"
          >
            <div>
              <p className="text-bodySm font-semibold text-ink">
                {row.label}
                {!row.optional && <span className="text-inkMuted"> (kohustuslik)</span>}
              </p>
              <p className="text-bodySm text-inkMuted">
                {row.at ? `Antud: ${formatDateTime(row.at)}` : 'Pole antud'}
              </p>
            </div>
            {row.optional ? (
              <FormCheck
                label={marketingGranted ? 'Keela' : 'Luba'}
                name="marketingConsent"
                checked={marketingGranted}
                disabled={busy}
                onChange={(event) => {
                  void toggleMarketing(event.target.checked)
                }}
              />
            ) : (
              <span className={pillMuted}>Lukus</span>
            )}
          </div>
        ))}
      </div>
      <p className="text-bodySm text-inkMuted">
        Kasutustingimuste ja privaatsuspoliitika nõusolek on konto kasutamiseks kohustuslik.
        Turundusteavitused on vabatahtlikud ja võid need igal ajal keelata.
      </p>
      {error && (
        <p role="alert" className="text-bodySm text-danger">
          {error}
        </p>
      )}
    </section>
  )
}
