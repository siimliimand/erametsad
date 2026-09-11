'use client'

import { useState } from 'react'

import { socialLinkFields, type SocialLinkUrls } from './social-links'
import { saveSocialLinksAction } from '../../../_actions/settings'
import { inputClass, primaryButtonClass } from '../../../_components/FormField'

/**
 * "Sotsiaalsed lingid" card for the Platvorm section (task 5.1): three URL
 * fields feeding the portal footer's Jälgi meid icons. Writes go through
 * saveSocialLinksAction, which re-checks settings:write (D-6) and validates
 * the URLs server-side; type="url" here is browser UX only.
 */
export function SocialLinks({ urls }: { urls: SocialLinkUrls }) {
  const [values, setValues] = useState<SocialLinkUrls>(urls)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  function submit(): void {
    if (busy) return
    setBusy(true)
    void saveSocialLinksAction({
      facebookUrl: values.facebook,
      instagramUrl: values.instagram,
      youtubeUrl: values.youtube,
      reason,
    })
      .then((result) => {
        if (result.ok) {
          setMessage({ tone: 'ok', text: 'Sotsiaalsed lingid salvestatud.' })
          setReason('')
        } else {
          setMessage({ tone: 'error', text: result.error ?? 'Salvestamine ebaõnnestus.' })
        }
      })
      .finally(() => {
        setBusy(false)
      })
  }

  return (
    <form
      className="space-y-sm border-b border-border px-md py-sm last:border-b-0"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <h3 className="text-label font-semibold text-ink">Sotsiaalsed lingid</h3>
      <p className="text-bodySm text-inkMuted">
        Lingid kuvatakse portaali jaluses ikoonidena. Tühi väli peidab ikooni.
      </p>

      {message ? (
        <p
          role="status"
          className={`rounded-card px-sm py-xs text-label font-medium ${
            message.tone === 'ok' ? 'bg-infoLight text-info' : 'bg-dangerLight text-danger'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        {socialLinkFields.map((field) => (
          <label key={field.network} className="flex flex-col gap-1">
            <span className="text-label font-semibold text-ink">{field.label}</span>
            <input
              type="url"
              value={values[field.network]}
              placeholder={field.network === 'youtube' ? 'https://youtube.com/@erametsad' : `https://${field.network}.com/erametsad`}
              onChange={(event) => {
                setValues((current) => ({ ...current, [field.network]: event.target.value }))
              }}
              className={inputClass}
            />
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-label font-semibold text-ink">Põhjendus (kohustuslik)</span>
        <textarea
          rows={2}
          required
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
          }}
          className={`${inputClass} h-auto py-2`}
        />
      </label>

      <div>
        <button
          type="submit"
          disabled={busy}
          className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Salvesta
        </button>
      </div>
    </form>
  )
}
