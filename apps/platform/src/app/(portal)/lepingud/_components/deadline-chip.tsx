'use client'

import { useEffect, useState } from 'react'

function fmtDate(value: string): string | null {
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  return new Date(time).toLocaleDateString('et-EE', { dateStyle: 'long' })
}

function remainingParts(deadlineMs: number): { days: number; hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.floor((deadlineMs - Date.now()) / 60000))
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
  }
}

interface DeadlineChipProps {
  deadlineIso: string
}

/**
 * Winner-contract signing deadline chip. Urgency colors: neutral → amber
 * under 3 days → red under 24 hours; expired shows a static warning.
 */
export function DeadlineChip({ deadlineIso }: DeadlineChipProps) {
  const deadlineMs = Date.parse(deadlineIso)
  const valid = !Number.isNaN(deadlineMs)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!valid) return
    const id = setInterval(() => {
      setTick((value) => value + 1)
    }, 30_000)
    return () => {
      clearInterval(id)
    }
  }, [valid])

  if (!valid) return null

  const dateLabel = fmtDate(deadlineIso)
  const expired = deadlineMs <= Date.now()
  const hoursLeft = (deadlineMs - Date.now()) / 3_600_000
  const urgent = !expired && hoursLeft < 24
  const warning = !expired && !urgent && hoursLeft < 72

  const toneClass = expired || urgent ? 'border-danger/30 bg-danger/10 text-danger' : warning ? 'border-statusEndingSoon/30 bg-statusEndingSoon/10 text-statusEndingSoon' : 'border-border bg-bgMist text-ink'
  const { days, hours, minutes } = remainingParts(deadlineMs)

  return (
    <div className={`flex flex-col gap-2xs rounded-card border px-md py-sm ${toneClass}`}>
      <span className="inline-flex items-center gap-xs font-label font-semibold">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {expired ? (
          <>Tähtaeg on möödunud</>
        ) : (
          <>
            Tähtaeg {dateLabel}
            <span className="font-mono">
              · jäänud {days}p {hours}h {minutes}m
            </span>
          </>
        )}
      </span>
      <span className="font-body text-bodySm">
        Allkirjasta leping {dateLabel ?? 'tähtajaks'} — vastasel juhul läheb oksjon järgmisele pakkujale.
      </span>
    </div>
  )
}
