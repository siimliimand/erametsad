'use client'

import { EE_COUNTIES, splitCadastreInput } from '@erametsad/types'
import { FormInput, FormSelect, type FormSelectOption } from '@erametsad/ui'

import type { SaleWizardData, StepErrors } from './types'

import { deriveSaleCounty } from '@/lib/object-submission'


const COUNTY_OPTIONS: FormSelectOption[] = EE_COUNTIES.map(({ code, name }) => ({
  value: code,
  label: name,
}))

interface LocationStepProps {
  sale: SaleWizardData
  errors: StepErrors
  onChange: (patch: Partial<SaleWizardData>) => void
}

export function LocationStep({ sale, errors, onChange }: LocationStepProps) {
  function handleCadastreInput(value: string) {
    // The first valid cadastre preselects the county; the select stays
    // editable (spec: cadastre derives county).
    const derived = deriveSaleCounty(splitCadastreInput(value))
    onChange(
      derived === null
        ? { cadastreInput: value }
        : { cadastreInput: value, county: derived },
    )
  }

  return (
    <fieldset className="flex flex-col gap-md">
      <legend className="mb-2xs font-heading text-h3 font-semibold text-ink">
        Kus objekt asub?
      </legend>
      <FormInput
        label="Metsamaa katastritunnus(ed)"
        name="cadastres"
        required
        hint="Eraldage mitu katastriüksust komade, tühikute või reavahetustega"
        value={sale.cadastreInput}
        onChange={(event) => {
          handleCadastreInput(event.target.value)
        }}
        {...(errors.cadastres ? { error: errors.cadastres } : {})}
      />
      <FormSelect
        label="Maakond"
        name="county"
        options={COUNTY_OPTIONS}
        placeholder="Vali maakond"
        hint="Täidetakse automaatselt katastritunnuse järgi."
        value={sale.county}
        onChange={(event) => {
          onChange({ county: event.target.value })
        }}
        {...(errors.county ? { error: errors.county } : {})}
      />
      <FormInput
        label="Aadress (valikuline)"
        name="address"
        value={sale.address}
        onChange={(event) => {
          onChange({ address: event.target.value })
        }}
        {...(errors.address ? { error: errors.address } : {})}
      />
    </fieldset>
  )
}
