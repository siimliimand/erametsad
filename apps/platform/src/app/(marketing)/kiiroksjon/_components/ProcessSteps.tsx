import type { LucideIcon } from 'lucide-react'

export interface ProcessStep {
  title: string
  description: string
  icon: LucideIcon
  emphasized?: boolean
}

// Design doc 07: the five-step process renders as a horizontal card row on
// desktop and a vertical numbered list on mobile. The guaranteed backup-offer
// step is the conversion core and gets the emphasis variant (accent border);
// its ShieldCheck icon keeps the emphasis non-color-only.
export function ProcessSteps({ steps }: { steps: ProcessStep[] }) {
  return (
    <ol className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-5">
      {steps.map((step, index) => {
        const Icon = step.icon
        return (
          <li
            key={step.title}
            className={
              step.emphasized
                ? 'rounded-card border-2 border-cta bg-bgPage p-md shadow-card'
                : 'rounded-card border border-border bg-bgPage p-md shadow-card'
            }
          >
            <div className="flex items-center justify-between">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-label font-bold text-inkInverse"
              >
                {index + 1}
              </span>
              <Icon
                className={
                  step.emphasized
                    ? 'h-6 w-6 text-cta'
                    : 'h-6 w-6 text-primary'
                }
                aria-hidden="true"
              />
            </div>
            <h3 className="mt-sm font-heading text-h4 text-ink">
              {step.title}
            </h3>
            <p className="mt-2xs text-bodySm text-inkMuted">
              {step.description}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
