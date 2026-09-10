import { Check } from 'lucide-react'

export const SIGNING_STEPS = [
  { id: 'andmed', label: 'Andmed' },
  { id: 'kontroll', label: 'Kontroll' },
  { id: 'allkiri', label: 'Allkiri' },
  { id: 'valmis', label: 'Valmis' },
] as const

interface SigningStepsProps {
  /** Contract type label above the bar ("Oksjonileping" / "Raamleping"). */
  typeLabel: string
  /** 1-based current step. */
  current: number
}

// Demo 13 steps-card: type label, the 4-step bar with numbered circles
// (done = filled with a check) and the "Allkirjastamine 1/4" progress on
// the right. Local to the signing flows; the shared Steps component keeps
// serving admin/marketing unchanged.
export function SigningSteps({ typeLabel, current }: SigningStepsProps) {
  return (
    <div className="rounded-card border border-border bg-white px-6 py-[18px] shadow-card">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-primary">
          {typeLabel}
        </span>
        <ol
          aria-label="Allkirjastamise sammud"
          className="m-0 flex list-none flex-1 basis-[280px] flex-wrap items-center gap-x-6 p-0"
        >
          {SIGNING_STEPS.map((step, index) => {
            const number = index + 1
            const isDone = number < current
            const isCurrent = number === current
            return (
              <li
                key={step.id}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex items-center gap-2 text-bodySm font-semibold ${
                  isCurrent ? 'text-ink' : isDone ? 'text-primary' : 'text-inkMuted'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-2 text-xs ${
                    isDone
                      ? 'border-primary bg-primary text-white'
                      : isCurrent
                        ? 'border-primary bg-white text-primary'
                        : 'border-border bg-white text-inkMuted'
                  }`}
                >
                  {isDone ? <Check size={13} strokeWidth={3} /> : number}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </li>
            )
          })}
        </ol>
        <span className="ml-auto whitespace-nowrap font-mono text-[13px] font-medium text-inkMuted">
          Allkirjastamine {current}/{SIGNING_STEPS.length}
        </span>
      </div>
    </div>
  )
}
