function fmtDate(value: string | null): string | null {
  if (value === null) return null
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  return new Date(time).toLocaleDateString('et-EE', { dateStyle: 'long' })
}

function CheckIcon({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
        done ? 'border-statusActive bg-statusActive text-white' : 'border-border bg-white text-transparent'
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3.5 w-3.5">
        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

interface ContractTimelineProps {
  status: 'prepared' | 'sent' | 'signed' | 'voided'
  createdAt: string | null
  sentAt: string | null
  signedAt: string | null
}

/**
 * Koostatud → Saadetud allkirjastamisele → Allkirjastatud; `voided` swaps the
 * final state for Tühistatud.
 */
export function ContractTimeline({ status, createdAt, sentAt, signedAt }: ContractTimelineProps) {
  const states = [
    { label: 'Koostatud', date: fmtDate(createdAt), done: true },
    {
      label: 'Saadetud allkirjastamisele',
      date: fmtDate(sentAt),
      done: status === 'sent' || status === 'signed' || status === 'voided',
    },
  ]
  if (status === 'voided') {
    states.push({ label: 'Tühistatud', date: null, done: false })
  } else {
    states.push({ label: 'Allkirjastatud', date: fmtDate(signedAt), done: status === 'signed' })
  }

  return (
    <ol className="flex flex-wrap items-center gap-x-sm gap-y-2xs" aria-label="Lepingu oleku ajajoon">
      {states.map((state, index) => (
        <li key={state.label} className="flex items-center gap-xs">
          {index > 0 && <span aria-hidden="true" className="h-px w-6 bg-border" />}
          <CheckIcon done={state.done} />
          <span className="flex flex-col">
            <span
              className={`font-label font-semibold ${state.done ? 'text-ink' : 'text-inkMuted'} ${
                state.label === 'Tühistatud' ? 'text-danger' : ''
              }`}
            >
              {state.label}
            </span>
            {state.date !== null && (
              <span className="font-body text-bodySm text-inkMuted">{state.date}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}
