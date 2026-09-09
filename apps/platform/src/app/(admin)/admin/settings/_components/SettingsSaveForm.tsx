'use client'

import { useState, useTransition } from 'react'
import type { ReactNode } from 'react'

import { updateSettingsAction } from '../../../_actions/content'
import { FormTextareaField, primaryButtonClass } from '../../../_components/FormField'
import { Switch } from '../../../_components/ui/Switch'
import { useToast } from '../../../_components/ui/Toast'

/** Serializable description of a boolean setting rendered as a Switch row. */
export interface SettingsSwitchField {
  name: string
  label: string
  hint?: string
  checked: boolean
}

// The audited action always redirects: success lands on /admin/settings
// (optionally ?ok=tasud), validation failures land there with ?viga=..., and an
// expired session redirects to /login. Only a settings redirect without viga is
// a save; the other cases keep their existing redirect-driven handling.
const settingsRedirectPrefix = '/admin/settings'

// Mirrors UserDrawer.isRedirectSignal: a redirecting server action rejects with
// a NEXT_REDIRECT digest (`NEXT_REDIRECT;replace;<url>;<status>`).
function redirectTargetUrl(error: unknown): string | null {
  const digest = (error as { digest?: unknown } | null)?.digest
  if (typeof digest !== 'string' || !digest.startsWith('NEXT_REDIRECT')) {
    return null
  }
  return digest.split(';')[2] ?? ''
}

function auditTimeLabel(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Per-section save form (demo 13-settings). The section fields render
 * server-side and arrive as children; only this shell is client, because the
 * Switch onChange and the save toast need the client boundary (a whole-file
 * boundary would break the server-rendered IntegrationKeys env reads). The
 * mandatory reason field stays on every save (design D7).
 */
export function SettingsSaveForm({
  section,
  switchField,
  children,
}: {
  section: string
  switchField?: SettingsSwitchField
  children: ReactNode
}) {
  const pushToast = useToast()
  const [pending, startTransition] = useTransition()
  const [switchChecked, setSwitchChecked] = useState(switchField?.checked ?? false)

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      try {
        await updateSettingsAction(formData)
      } catch (error) {
        const target = redirectTargetUrl(error)
        if (target === null) {
          pushToast({ tone: 'error', title: 'Salvestamine ebaõnnestus.' })
          return
        }
        // Validation failures (?viga=) show the page ErrorNotice after the
        // redirect; unrelated redirects (login) just navigate.
        if (!target.startsWith(settingsRedirectPrefix) || target.includes('viga=')) {
          return
        }
      }
      pushToast({
        tone: 'success',
        title: 'Seaded salvestatud',
        description: `Logitud auditilogisse: settings.change · ${auditTimeLabel(new Date())}`,
      })
    })
  }

  return (
    <form action={handleSubmit} className="border-b border-border last:border-b-0">
      <input type="hidden" name="section" value={section} />
      <div className="space-y-sm px-md py-sm">
        {children}
        {switchField ? (
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-xs text-label font-semibold text-ink">
              <Switch
                checked={switchChecked}
                label={switchField.label}
                onChange={setSwitchChecked}
              />
              {switchField.label}
            </label>
            <input
              type="hidden"
              name={switchField.name}
              value={switchChecked ? 'true' : 'false'}
            />
            {switchField.hint ? (
              <p className="text-bodySm text-inkMuted">{switchField.hint}</p>
            ) : null}
          </div>
        ) : null}
        <FormTextareaField
          id={`reason-${section}`}
          label="Põhjendus (kohustuslik)"
          name="reason"
          rows={2}
          required
          hint="Vähemalt 5 tähemärki. Salvestus koos põhjendusega logitakse auditisse."
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-sm border-t border-border px-md py-sm">
        <p className="text-label text-inkMuted">Muudatused logitakse auditilogisse</p>
        <button
          type="submit"
          disabled={pending}
          className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Salvesta
        </button>
      </div>
    </form>
  )
}
