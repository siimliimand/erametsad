'use client'

import { NOTIFICATION_EVENTS } from './notifications-data'

function Toggle({ checked, label }: { checked: boolean; label: string }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled
        className="h-4 w-4 accent-primary"
        aria-label={label}
      />
      <span className="font-body text-bodySm text-inkMuted">
        {checked ? 'Saadetakse' : 'Ei saadeta'}
      </span>
    </label>
  )
}

// Preference storage does not exist yet: the service falls back to hardcoded
// defaults and the profiles API allowlist has no notification fields, so the
// matrix shows the current effective behavior with all toggles disabled.
export function PreferenceMatrix() {
  return (
    <div className="flex flex-col gap-md">
      <div className="rounded-card border border-border bg-bgMist px-md py-sm">
        <p className="font-body text-bodySm text-ink">
          Sündmuspõhiste teavitussätete salvestamine pole veel saadaval: profiili liides ja
          andmeskeem ei sisalda veel teavitussätete välju. Tabel näitab süsteemi hetkel kehtivaid
          sätteid; lülitid lubatakse, kui salvestus valmib.
        </p>
      </div>

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full min-w-[480px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-bgMist">
              <th scope="col" className="px-md py-sm font-body text-bodySm font-semibold text-primary">
                Sündmus
              </th>
              <th scope="col" className="px-md py-sm font-body text-bodySm font-semibold text-primary">
                E-post
              </th>
              <th scope="col" className="px-md py-sm font-body text-bodySm font-semibold text-primary">
                SMS
              </th>
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_EVENTS.map((event) => (
              <tr key={event.value} className="border-b border-border last:border-b-0">
                <td className="px-md py-sm font-body text-body text-ink">{event.settingsLabel}</td>
                <td className="px-md py-sm">
                  {event.emailAvailable ? (
                    <Toggle
                      checked={event.effectiveEmail}
                      label={`E-post: ${event.settingsLabel}`}
                    />
                  ) : (
                    <span className="font-body text-bodySm text-inkMuted">Ainult rakenduses</span>
                  )}
                </td>
                <td className="px-md py-sm">
                  {event.smsAvailable ? (
                    <Toggle checked={event.effectiveSms} label={`SMS: ${event.settingsLabel}`} />
                  ) : (
                    <span className="font-body text-bodySm text-inkMuted">–</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-body text-bodySm text-inkMuted">
        SMS-teavitus on võimalik ainult võidu ja lepingu sündmuste puhul. SMS-i saamiseks peab
        telefoninumber olema profiilis kinnitatud.
      </p>
    </div>
  )
}
