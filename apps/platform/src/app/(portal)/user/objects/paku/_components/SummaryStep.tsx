'use client'

import {
  EE_COUNTIES,
  HOOLDUSRAIE_SERVICE_OPTIONS,
  ISTUTAMINE_SERVICE_OPTIONS,
  type ServiceRequestType,
} from '@erametsad/types'
import { Btn, ConsentCheck } from '@erametsad/ui'
import { AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import { findServiceOption } from './types'
import type { ObjectWizardData, StepErrors } from './types'
import { serviceTypeLabel } from './wizard-validation'

interface SummaryStepProps {
  data: ObjectWizardData
  errors: StepErrors
  submitting: boolean
  submitError: string | null
  onConsentChange: (consentAt: string | null) => void
  onSubmit: () => void
}

const CONSENT_SERVICE_NAME: Record<ServiceRequestType, string> = {
  kava: 'metsamajanduskava',
  hooldusraie: 'hooldusraie',
  istutamine: 'metsa istutamise',
}

function countyName(code: string): string {
  return EE_COUNTIES.find((county) => county.code === code)?.name ?? code
}

function cadastreList(input: string): string {
  return input
    .split(/[\s,]+/)
    .filter(Boolean)
    .join(', ')
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="text-bodySm font-semibold text-inkMuted sm:w-48 sm:shrink-0">{label}</dt>
      <dd className="text-body text-ink">{value}</dd>
    </div>
  )
}

function SaleRows({ data }: { data: ObjectWizardData }) {
  const { sale } = data
  const service = findServiceOption(
    sale.objectType === null ? null : `sale:${sale.objectType}`,
  )
  return (
    <>
      <Row label="Teenus" value={service?.label ?? '—'} />
      <Row label="Katastritunnused" value={cadastreList(sale.cadastreInput) || '—'} />
      <Row label="Maakond" value={sale.county ? countyName(sale.county) : '—'} />
      <Row label="Aadress" value={sale.address.trim() || '—'} />
      <Row label="Pindala" value={sale.areaHa.trim() ? `${sale.areaHa.trim()} ha` : '—'} />
      <Row label="Puuliigid" value={sale.species.join(', ') || '—'} />
      <Row label="Raieliigid" value={sale.loggingTypes.join(', ') || '—'} />
      <Row
        label="Raiemahu"
        value={sale.volumeM3.trim() ? `${sale.volumeM3.trim()} m³` : '—'}
      />
      <Row
        label="Failid"
        value={
          sale.files.length > 0
            ? `${sale.files.map((file) => file.name).join(', ')} (${String(sale.files.length)})`
            : '—'
        }
      />
      <Row label="Kirjeldus" value={sale.description.trim() || '—'} />
    </>
  )
}

function ServiceRows({ data }: { data: ObjectWizardData }) {
  const { service } = data
  const serviceOptions =
    service.serviceType === 'hooldusraie'
      ? HOOLDUSRAIE_SERVICE_OPTIONS
      : service.serviceType === 'istutamine'
        ? ISTUTAMINE_SERVICE_OPTIONS
        : []
  const selectedServices = serviceOptions
    .filter((option) => service.services.includes(option.value))
    .map((option) => option.label)
  return (
    <>
      <Row
        label="Teenus"
        value={service.serviceType ? serviceTypeLabel(service.serviceType) : '—'}
      />
      <Row label="Katastritunnused" value={cadastreList(service.cadastreInput) || '—'} />
      {service.serviceType !== 'kava' && (
        <Row label="Maakond" value={service.county ? countyName(service.county) : '—'} />
      )}
      {service.serviceType !== 'kava' && (
        <Row label="Ülesanded ja tingimused" value={service.provisions.trim() || '—'} />
      )}
      {serviceOptions.length > 0 && (
        <Row
          label="Valitud teenused"
          value={selectedServices.length > 0 ? selectedServices.join(', ') : '—'}
        />
      )}
      {service.serviceType === 'kava' && (
        <Row label="Kava paberkandjal" value={service.paperCopy ? 'Jah' : 'Ei'} />
      )}
      {service.serviceType === 'hooldusraie' && (
        <Row label="Fail" value={service.file ? service.file.name : '—'} />
      )}
      <Row label="Kommentaar" value={service.comment.trim() || '—'} />
    </>
  )
}

export function SummaryStep({
  data,
  errors,
  submitting,
  submitError,
  onConsentChange,
  onSubmit,
}: SummaryStepProps) {
  const serviceType = data.service.serviceType
  return (
    <fieldset className="flex flex-col gap-md">
      <legend className="mb-2xs font-heading text-h3 font-semibold text-ink">
        Kontrolli andmed
      </legend>
      <dl className="flex flex-col gap-sm">
        {data.branch === 'sale' ? <SaleRows data={data} /> : <ServiceRows data={data} />}
      </dl>
      <Row
        label="Kontakt"
        value={`${data.contact.name} · ${data.contact.phone} · ${data.contact.email}`}
      />

      {data.branch === 'service' && serviceType !== null && (
        <ConsentCheck
          name="consent"
          label={`Nõustun, et minu andmed edastatakse ${
            CONSENT_SERVICE_NAME[serviceType]
          } teenuse pakkujatele, kes võivad minuga ühendust võtta.`}
          onChange={(checked) => {
            onConsentChange(checked ? new Date().toISOString() : null)
          }}
          {...(errors.consentAt ? { error: errors.consentAt } : {})}
        />
      )}

      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-input border border-danger bg-danger/5 px-4 py-3 text-bodySm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      )}

      <Btn type="button" variant="cta" size="lg" isLoading={submitting} onClick={onSubmit}>
        Saada
      </Btn>
    </fieldset>
  )
}
