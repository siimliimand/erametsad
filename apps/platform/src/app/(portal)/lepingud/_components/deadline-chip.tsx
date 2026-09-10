'use client'

import { Hourglass } from 'lucide-react'
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
 * Winner-contract deadline banner (demo 13): amber band with the bold date
 * and the consequence sentence, plus the live countdown chip. Urgency
 * colors: amber under 3 days → red under 24 hours; expired shows a static
 * warning.
 */
export function DeadlineBanner({ deadlineIso }: DeadlineChipProps) {
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

  const bannerClass = expired || urgent ? 'bg-danger/10' : 'bg-statusEndingSoon/10'
  const accentClass = expired || urgent ? 'text-danger' : 'text-ctaHover'
  const chipClass = expired || urgent
    ? 'border-danger/30 text-danger'
    : warning
      ? 'border-statusEndingSoon/40 text-ctaHover'
      : 'border-border bg-white text-ink'
  const { days, hours, minutes } = remainingParts(deadlineMs)

  return (
    <div
      role="note"
      className={`flex flex-wrap items-center gap-3.5 rounded-card px-5 py-4 ${bannerClass}`}
    >
      <Hourglass aria-hidden="true" size={20} className={`flex-none ${accentClass}`} />
      <p className="min-w-[260px] flex-1 font-body text-bodySm text-ink">
        <b className={`font-semibold ${accentClass}`}>Allkirjasta {dateLabel ?? 'tähtajaks'}</b> —
        vastasel juhul läheb oksjon järgmisele pakkujale.
      </p>
      <span
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border px-3 py-1 font-mono text-[13px] font-medium ${chipClass}`}
      >
        {expired ? (
          <>Tähtaeg on möödunud</>
        ) : (
          <>
            jäänud {days}p {hours}h {minutes}m
          </>
        )}
      </span>
    </div>
  )
}
