function fmtDate(value: string | null): string | null {
  if (value === null) return null
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  return new Date(time).toLocaleDateString('et-EE', { dateStyle: 'long' })
}

interface RailState {
  label: string
  date: string | null
  done: boolean
  current: boolean
  danger?: boolean
}

function railDot(state: RailState): string {
  if (state.danger) return 'border-danger bg-danger'
  if (state.current) return 'border-ctaHover bg-cta'
  if (state.done) return 'border-primary bg-primary'
  return 'border-border bg-white'
}

function railLabel(state: RailState): string {
  if (state.danger) return 'text-danger'
  if (state.current) return 'text-ink'
  if (state.done) return 'text-primary'
  return 'text-inkMuted'
}

interface ContractTimelineProps {
  status: 'prepared' | 'sent' | 'signed' | 'voided'
  createdAt: string | null
  sentAt: string | null
  signedAt: string | null
}

/**
 * Demo 13 status rail: Koostatud → Saadetud allkirjastamisele →
 * Allkirjastatud → Erametsadi vastuallkiri (flips to "Ootab Erametsadi
 * vastuallkirja" once signed); `voided` swaps the tail for Tühistatud.
 */
export function ContractTimeline({ status, createdAt, sentAt, signedAt }: ContractTimelineProps) {
  const signed = status === 'signed'
  const states: RailState[] = [
    { label: 'Koostatud', date: fmtDate(createdAt), done: true, current: false },
    {
      label: 'Saadetud allkirjastamisele',
      date: fmtDate(sentAt),
      done: status === 'sent' || signed || status === 'voided',
      current: status === 'sent',
    },
  ]
  if (status === 'voided') {
    states.push({ label: 'Tühistatud', date: null, done: false, current: false, danger: true })
  } else {
    states.push({
      label: 'Allkirjastatud',
      date: fmtDate(signedAt),
      done: signed,
      current: false,
    })
    states.push({
      label: signed ? 'Ootab Erametsadi vastuallkirja' : 'Erametsadi vastuallkiri',
      date: null,
      done: false,
      current: signed,
    })
  }

  return (
    <div
      role="list"
      aria-label="Lepingu staatus"
      className="flex flex-wrap items-center gap-x-7 gap-y-2.5 rounded-card bg-bgMist px-5 py-4"
    >
      {states.map((state) => (
        <span
          key={state.label}
          role="listitem"
          className={`flex items-center gap-2 text-bodySm font-semibold ${railLabel(state)}`}
        >
          <span aria-hidden="true" className={`h-2.5 w-2.5 flex-none rounded-full border-2 ${railDot(state)}`} />
          {state.label}
          {state.date !== null && <span className="font-mono font-medium">{state.date}</span>}
        </span>
      ))}
    </div>
  )
}
