import { CheckIcon } from './icons'

export interface StepBarItem {
  id: string
  label: string
}

interface StepBarProps {
  steps: StepBarItem[]
  // 1-based position of the current step.
  current: number
}

// Demo step-bar visual (06-register.html .steps): numbered circles with
// connectors, the active step filled, done steps showing a check. Kept local
// to the register wizard because the shared Steps component serves other
// surfaces whose presentation must not change.
export function StepBar({ steps, current }: StepBarProps) {
  return (
    <ol
      aria-label="Registreerimise sammud"
      className="m-0 flex list-none flex-wrap items-center justify-center p-0"
    >
      {steps.map((step, index) => {
        const number = index + 1
        const isDone = number < current
        const isActive = number === current
        return (
          <li
            key={step.id}
            aria-current={isActive ? 'step' : undefined}
            className={`flex items-center gap-2 text-bodySm font-semibold ${
              isActive ? 'text-ink' : isDone ? 'text-primaryHover' : 'text-inkMuted'
            }`}
          >
            {index > 0 && (
              <span
                aria-hidden="true"
                className="mx-2 h-[1.5px] w-6 bg-border sm:mx-3 sm:w-10"
              />
            )}
            <span
              className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border-[1.5px] font-mono text-[13px] font-medium ${
                isActive
                  ? 'border-primary bg-primary text-inkInverse'
                  : isDone
                    ? 'border-primary bg-primaryLight text-primaryHover'
                    : 'border-border bg-bgPage text-inkMuted'
              }`}
            >
              {isDone ? <CheckIcon className="h-3.5 w-3.5" /> : number}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
