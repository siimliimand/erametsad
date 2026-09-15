'use client'

import type { SaleWizardData, StepErrors } from './types'

interface DescriptionStepProps {
  sale: SaleWizardData
  errors: StepErrors
  onChange: (patch: Partial<SaleWizardData>) => void
}

export function DescriptionStep({ sale, errors, onChange }: DescriptionStepProps) {
  const error = errors.description
  const errorId = 'sale-description-error'
  return (
    <fieldset className="flex flex-col gap-md">
      <legend className="mb-2xs font-heading text-h3 font-semibold text-ink">
        Kirjelda objekti
      </legend>
      <div className="flex flex-col gap-1">
        <label htmlFor="sale-description" className="text-body font-semibold text-primary">
          Kirjeldus
        </label>
        <textarea
          id="sale-description"
          name="description"
          rows={6}
          required
          value={sale.description}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            onChange({ description: event.target.value })
          }}
          className="w-full rounded-input border border-border bg-bgPage p-3 text-body outline-none transition-all duration-hover ease-hover motion-reduce:transition-none focus:border-primary focus:ring-2 focus:ring-primary/20 aria-invalid:border-danger"
        />
        {error && (
          <p id={errorId} role="alert" className="text-bodySm text-danger">
            {error}
          </p>
        )}
      </div>
    </fieldset>
  )
}
