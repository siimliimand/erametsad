'use client'

import {
  EE_COUNTIES,
  HOOLDUSRAIE_SERVICE_OPTIONS,
  ISTUTAMINE_SERVICE_OPTIONS,
  splitCadastreInput,
  type ServiceRequestType,
} from '@erametsad/types'
import { FormCheck, FormFile, FormInput, FormSelect, type FormSelectOption } from '@erametsad/ui'

import type { ServiceWizardData, StepErrors } from './types'

import { deriveSaleCounty } from '@/lib/object-submission'


const COUNTY_OPTIONS: FormSelectOption[] = EE_COUNTIES.map(({ code, name }) => ({
  value: code,
  label: name,
}))

const STEP_TITLE: Record<ServiceRequestType, string> = {
  kava: 'Metsamajanduskava',
  hooldusraie: 'Hooldusraie',
  istutamine: 'Metsa istutamine',
}

const PROVISIONS_LABEL: Record<Exclude<ServiceRequestType, 'kava'>, string> = {
  hooldusraie: 'Ülesanded ja tingimused',
  istutamine: 'Ülesanded ja tingimused',
}

interface ServiceDetailsStepProps {
  service: ServiceWizardData
  errors: StepErrors
  onChange: (patch: Partial<ServiceWizardData>) => void
}

export function ServiceDetailsStep({ service, errors, onChange }: ServiceDetailsStepProps) {
  const type: ServiceRequestType | null = service.serviceType
  const isKava = type === 'kava'
  const withFile = type === 'hooldusraie'
  const serviceOptions =
    type === 'hooldusraie'
      ? HOOLDUSRAIE_SERVICE_OPTIONS
      : type === 'istutamine'
        ? ISTUTAMINE_SERVICE_OPTIONS
        : []

  function handleCadastreInput(value: string) {
    const derived = deriveSaleCounty(splitCadastreInput(value))
    onChange(
      derived === null
        ? { cadastreInput: value }
        : { cadastreInput: value, county: derived },
    )
  }

  if (type === null) return null

  return (
    <fieldset className="flex flex-col gap-md">
      <legend className="mb-2xs font-heading text-h3 font-semibold text-ink">
        {STEP_TITLE[type]}
      </legend>
      <FormInput
        label="Metsamaa katastritunnus(ed)"
        name="service-cadastres"
        required
        hint="Eraldage mitu katastriüksust komade, tühikute või reavahetustega"
        value={service.cadastreInput}
        onChange={(event) => {
          handleCadastreInput(event.target.value)
        }}
        {...(errors.cadastres ? { error: errors.cadastres } : {})}
      />

      {!isKava && (
        <FormSelect
          label="Maakond"
          name="service-county"
          required
          options={COUNTY_OPTIONS}
          placeholder="Vali maakond"
          hint="Täidetakse automaatselt katastritunnuse järgi."
          value={service.county}
          onChange={(event) => {
            onChange({ county: event.target.value })
          }}
          {...(errors.county ? { error: errors.county } : {})}
        />
      )}

      {!isKava && (
        <FormInput
          label={PROVISIONS_LABEL[type]}
          name="service-provisions"
          required
          hint="nt 5, 7 — eraldise numbrid"
          value={service.provisions}
          onChange={(event) => {
            onChange({ provisions: event.target.value })
          }}
          {...(errors.provisions ? { error: errors.provisions } : {})}
        />
      )}

      {serviceOptions.length > 0 && (
        <fieldset className="flex flex-col gap-xs">
          <legend className="mb-2xs text-body font-semibold text-primary">
            Millist teenust vajate?
          </legend>
          {serviceOptions.map((option) => (
            <FormCheck
              key={option.value}
              name="service-services"
              label={option.label}
              checked={service.services.includes(option.value)}
              onChange={(event) => {
                const checked = event.target.checked
                onChange({
                  services: checked
                    ? [...service.services.filter((entry) => entry !== option.value), option.value]
                    : service.services.filter((entry) => entry !== option.value),
                })
              }}
            />
          ))}
          {errors.services && (
            <p role="alert" className="text-bodySm text-danger">
              {errors.services}
            </p>
          )}
        </fieldset>
      )}

      {isKava && (
        <FormCheck
          name="paper_copy"
          label="Soovin lisaks kava paberkandjal"
          checked={service.paperCopy}
          onChange={(event) => {
            onChange({ paperCopy: event.target.checked })
          }}
        />
      )}

      {withFile && (
        <FormFile
          name="service-file"
          accept=".pdf,.jpg,.jpeg,.png"
          maxSize={10 * 1024 * 1024}
          label="Lisa kava fail (valikuline)"
          hint="PDF, JPG või PNG kuni 10 MB"
          onChange={(files) => {
            onChange({ file: files[0] ?? null })
          }}
        />
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="service-comment" className="text-body font-semibold text-primary">
          Lisa kommentaar
        </label>
        <textarea
          id="service-comment"
          name="comment"
          rows={4}
          value={service.comment}
          aria-invalid={Boolean(errors.comment)}
          aria-describedby={errors.comment ? 'service-comment-error' : undefined}
          onChange={(event) => {
            onChange({ comment: event.target.value })
          }}
          className="w-full rounded-input border border-border bg-bgPage p-3 text-body outline-none transition-all duration-hover ease-hover motion-reduce:transition-none focus:border-primary focus:ring-2 focus:ring-primary/20 aria-invalid:border-danger"
        />
        {errors.comment && (
          <p id="service-comment-error" role="alert" className="text-bodySm text-danger">
            {errors.comment}
          </p>
        )}
      </div>
    </fieldset>
  )
}
