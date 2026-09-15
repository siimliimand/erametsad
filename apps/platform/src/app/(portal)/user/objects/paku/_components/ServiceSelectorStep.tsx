'use client'

import { WIZARD_SERVICES, type WizardServiceOption } from './types'

interface ServiceSelectorStepProps {
  selectedKey: string | null
  error?: string
  onSelect: (option: WizardServiceOption) => void
}

export function ServiceSelectorStep({
  selectedKey,
  error,
  onSelect,
}: ServiceSelectorStepProps) {
  return (
    <fieldset className="flex flex-col gap-sm">
      <legend className="mb-2xs font-heading text-h3 font-semibold text-ink">
        Mida soovid teha?
      </legend>
      <div className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {WIZARD_SERVICES.map((option) => {
          const selected = option.key === selectedKey
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onSelect(option)
              }}
              className={`flex flex-col items-start gap-1 rounded-card border p-md text-left transition-colors duration-hover ease-hover motion-reduce:transition-none ${
                selected
                  ? 'border-primary bg-primaryLight'
                  : 'border-border bg-bgPage hover:border-primary'
              }`}
            >
              <span className="font-label font-semibold text-ink">{option.label}</span>
              <span className="text-bodySm text-inkMuted">{option.hint}</span>
            </button>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="text-bodySm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  )
}
