'use client'

import { FormInput } from '@erametsad/ui'

import type { SaleWizardData, StepErrors } from './types'

import { loggingTypeCodes, speciesCodes } from '@/app/(admin)/admin/auctions/_lib/auction-schema'


interface ObjectDataStepProps {
  sale: SaleWizardData
  errors: StepErrors
  onChange: (patch: Partial<SaleWizardData>) => void
}

interface CodeChipGroupProps {
  legend: string
  name: string
  codes: readonly string[]
  selected: readonly string[]
  error?: string
  onToggle: (code: string, checked: boolean) => void
}

/** The admin wizard shows these codes as-is; the portal keeps the same. */
function CodeChipGroup({ legend, name, codes, selected, error, onToggle }: CodeChipGroupProps) {
  return (
    <fieldset className="flex flex-col gap-xs">
      <legend className="mb-2xs text-body font-semibold text-primary">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {codes.map((code) => (
          <label key={code} className="cursor-pointer">
            <input
              type="checkbox"
              name={name}
              className="peer sr-only"
              checked={selected.includes(code)}
              onChange={(event) => {
                onToggle(code, event.target.checked)
              }}
            />
            <span
              className={`inline-flex items-center rounded-pill border px-3 py-1 text-[13px] font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 ${
                selected.includes(code)
                  ? 'border-primary bg-primary text-inkInverse'
                  : 'border-border bg-bgPage text-ink hover:border-primary hover:text-primary'
              }`}
            >
              {code}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-bodySm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  )
}

export function ObjectDataStep({ sale, errors, onChange }: ObjectDataStepProps) {
  function toggleCode(field: 'species' | 'loggingTypes', code: string, checked: boolean) {
    const current = field === 'species' ? sale.species : sale.loggingTypes
    const next = checked
      ? [...current.filter((entry) => entry !== code), code]
      : current.filter((entry) => entry !== code)
    onChange(field === 'species' ? { species: next } : { loggingTypes: next })
  }

  return (
    <fieldset className="flex flex-col gap-md">
      <legend className="mb-2xs font-heading text-h3 font-semibold text-ink">
        Mis objektiga on tegu?
      </legend>
      <FormInput
        label="Pindala (ha)"
        name="areaHa"
        type="number"
        required
        min="0"
        step="any"
        inputMode="decimal"
        value={sale.areaHa}
        onChange={(event) => {
          onChange({ areaHa: event.target.value })
        }}
        {...(errors.areaHa ? { error: errors.areaHa } : {})}
      />
      <CodeChipGroup
        legend="Puuliigid"
        name="species"
        codes={speciesCodes}
        selected={sale.species}
        {...(errors.species ? { error: errors.species } : {})}
        onToggle={(code, checked) => {
          toggleCode('species', code, checked)
        }}
      />
      <CodeChipGroup
        legend="Raieliigid"
        name="loggingTypes"
        codes={loggingTypeCodes}
        selected={sale.loggingTypes}
        {...(errors.loggingTypes ? { error: errors.loggingTypes } : {})}
        onToggle={(code, checked) => {
          toggleCode('loggingTypes', code, checked)
        }}
      />
      <FormInput
        label="Raiemahu (m³, valikuline)"
        name="volumeM3"
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        value={sale.volumeM3}
        onChange={(event) => {
          onChange({ volumeM3: event.target.value })
        }}
        {...(errors.volumeM3 ? { error: errors.volumeM3 } : {})}
      />
    </fieldset>
  )
}
