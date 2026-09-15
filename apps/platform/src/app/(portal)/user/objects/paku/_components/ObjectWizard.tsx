'use client'

import { Btn } from '@erametsad/ui'
import { useState } from 'react'

import { ContactStep } from './ContactStep'
import { DescriptionStep } from './DescriptionStep'
import { LocationStep } from './LocationStep'
import { ObjectDataStep } from './ObjectDataStep'
import { SaleFilesStep } from './SaleFilesStep'
import { ServiceDetailsStep } from './ServiceDetailsStep'
import { ServiceSelectorStep } from './ServiceSelectorStep'
import { SummaryStep } from './SummaryStep'
import type {
  ContactPrefill,
  ObjectWizardData,
  ObjectWizardProps,
  SaleWizardData,
  ServiceWizardData,
  StepErrors,
  WizardServiceOption,
  WizardStep,
  WizardStepId,
} from './types'
import { validateStep } from './wizard-validation'

const SALE_STEPS: readonly WizardStep[] = [
  { id: 'service', label: 'Teenus' },
  { id: 'location', label: 'Asukoht' },
  { id: 'object-data', label: 'Objekti andmed' },
  { id: 'files', label: 'Failid' },
  { id: 'description', label: 'Kirjeldus' },
  { id: 'contact', label: 'Kontaktandmed' },
  { id: 'summary', label: 'Kokkuvõte' },
]

const SERVICE_STEPS: readonly WizardStep[] = [
  { id: 'service', label: 'Teenus' },
  { id: 'service-details', label: 'Päringu andmed' },
  { id: 'contact', label: 'Kontaktandmed' },
  { id: 'summary', label: 'Kokkuvõte' },
]

function stepsForBranch(branch: ObjectWizardData['branch']): readonly WizardStep[] {
  return branch === 'sale' ? SALE_STEPS : SERVICE_STEPS
}

function emptySale(): SaleWizardData {
  return {
    objectType: null,
    cadastreInput: '',
    county: '',
    address: '',
    areaHa: '',
    species: [],
    loggingTypes: [],
    volumeM3: '',
    files: [],
    description: '',
  }
}

function emptyService(): ServiceWizardData {
  return {
    serviceType: null,
    cadastreInput: '',
    county: '',
    provisions: '',
    services: [],
    paperCopy: false,
    comment: '',
    file: null,
  }
}

function initialContact(prefill: ContactPrefill): ObjectWizardData['contact'] {
  return {
    name: prefill.name ?? '',
    email: prefill.email ?? '',
    phone: prefill.phone ?? '',
  }
}

export function ObjectWizard({
  contactPrefill,
  onSubmit,
  submitting = false,
  submitError = null,
}: ObjectWizardProps) {
  const [data, setData] = useState<ObjectWizardData>(() => ({
    branch: 'sale',
    sale: emptySale(),
    service: emptyService(),
    contact: initialContact(contactPrefill),
    consentAt: null,
  }))
  const [stepIndex, setStepIndex] = useState(0)
  const [errors, setErrors] = useState<StepErrors>({})

  const steps = stepsForBranch(data.branch)
  const current: WizardStep =
    steps[Math.min(stepIndex, steps.length - 1)] ?? steps[0] ?? { id: 'service', label: 'Teenus' }
  const isSummary = current.id === 'summary'

  function selectedServiceKey(): string | null {
    if (data.branch === 'sale') {
      return data.sale.objectType === null ? null : `sale:${data.sale.objectType}`
    }
    return data.service.serviceType === null ? null : `service:${data.service.serviceType}`
  }

  function patchSale(patch: Partial<SaleWizardData>) {
    setData((previous) => ({ ...previous, sale: { ...previous.sale, ...patch } }))
  }

  function patchService(patch: Partial<ServiceWizardData>) {
    setData((previous) => ({ ...previous, service: { ...previous.service, ...patch } }))
  }

  function patchContact(patch: Partial<ObjectWizardData['contact']>) {
    setData((previous) => ({ ...previous, contact: { ...previous.contact, ...patch } }))
  }

  function selectService(option: WizardServiceOption) {
    setData((previous) => ({
      ...previous,
      branch: option.branch,
      sale:
        option.branch === 'sale'
          ? { ...previous.sale, objectType: option.saleObjectType ?? null }
          : previous.sale,
      service:
        option.branch === 'service'
          ? { ...previous.service, serviceType: option.serviceType ?? null }
          : previous.service,
    }))
    setErrors({})
  }

  function goNext() {
    const stepErrors = validateStep(current.id, data)
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length > 0) return
    setStepIndex((index) => Math.min(index + 1, steps.length - 1))
  }

  function goBack() {
    setErrors({})
    setStepIndex((index) => Math.max(index - 1, 0))
  }

  function handleSubmit() {
    const stepErrors = validateStep('summary', data)
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length > 0) return
    void onSubmit(data)
  }

  function renderStep(stepId: WizardStepId) {
    switch (stepId) {
      case 'service':
        return (
          <ServiceSelectorStep
            selectedKey={selectedServiceKey()}
            {...(errors.service ? { error: errors.service } : {})}
            onSelect={selectService}
          />
        )
      case 'location':
        return <LocationStep sale={data.sale} errors={errors} onChange={patchSale} />
      case 'object-data':
        return <ObjectDataStep sale={data.sale} errors={errors} onChange={patchSale} />
      case 'files':
        return (
          <SaleFilesStep
            errors={errors}
            onChange={(files) => {
              patchSale({ files })
            }}
          />
        )
      case 'description':
        return <DescriptionStep sale={data.sale} errors={errors} onChange={patchSale} />
      case 'service-details':
        return <ServiceDetailsStep service={data.service} errors={errors} onChange={patchService} />
      case 'contact':
        return <ContactStep contact={data.contact} errors={errors} onChange={patchContact} />
      case 'summary':
        return (
          <SummaryStep
            data={data}
            errors={errors}
            submitting={submitting}
            submitError={submitError}
            onConsentChange={(consentAt) => {
              setData((previous) => ({ ...previous, consentAt }))
            }}
            onSubmit={handleSubmit}
          />
        )
    }
  }

  return (
    <section
      aria-label="Objekti pakkumise viisard"
      className="mx-auto flex w-full max-w-[880px] flex-col gap-md"
    >
      <ol className="flex flex-wrap items-center gap-2" aria-label="Viisardi sammud">
        {steps.map((step, index) => (
          <li key={step.id} aria-current={step.id === current.id ? 'step' : undefined}>
            <span
              className={`inline-flex items-center rounded-pill border px-3 py-1 text-[13px] font-semibold ${
                step.id === current.id
                  ? 'border-primary bg-primary text-inkInverse'
                  : 'border-border bg-bgPage text-inkMuted'
              }`}
            >
              {`${String(index + 1)}. ${step.label}`}
            </span>
          </li>
        ))}
      </ol>

      {/* Steps stay mounted so entered data survives moving back and forth. */}
      {steps.map((step) => (
        <div key={step.id} hidden={step.id !== current.id}>
          {renderStep(step.id)}
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-sm">
        {stepIndex > 0 ? (
          <Btn type="button" variant="outline" onClick={goBack} disabled={submitting}>
            Tagasi
          </Btn>
        ) : (
          <span aria-hidden="true" />
        )}
        {isSummary ? null : (
          <Btn type="button" variant="cta" onClick={goNext}>
            Edasi
          </Btn>
        )}
      </div>
    </section>
  )
}
