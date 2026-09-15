import type { ServiceRequestType } from '@erametsad/types'

import type { SaleObjectType } from '@/lib/object-submission'

/** The two wizard branches; selection on step 1 decides the step flow. */
export type WizardBranch = 'sale' | 'service'

export type WizardStepId =
  | 'service'
  | 'location'
  | 'object-data'
  | 'files'
  | 'description'
  | 'service-details'
  | 'contact'
  | 'summary'

export interface WizardStep {
  id: WizardStepId
  label: string
}

/** Field key -> first validation message for the current step. */
export type StepErrors = Record<string, string>

/** Contact fields shared by both branches; prefilled from the active profile. */
export interface ContactData {
  name: string
  email: string
  phone: string
}

export interface ContactPrefill {
  name: string | null
  email: string | null
  phone: string | null
}

/** Sale branch state: strings mirror raw inputs; payloads build from them. */
export interface SaleWizardData {
  objectType: SaleObjectType | null
  cadastreInput: string
  county: string
  address: string
  areaHa: string
  species: string[]
  loggingTypes: string[]
  volumeM3: string
  files: File[]
  description: string
}

/** Service branch state; per-type fields follow the service-request contract. */
export interface ServiceWizardData {
  serviceType: ServiceRequestType | null
  cadastreInput: string
  county: string
  provisions: string
  services: string[]
  paperCopy: boolean
  comment: string
  file: File | null
}

export interface ObjectWizardData {
  branch: WizardBranch
  sale: SaleWizardData
  service: ServiceWizardData
  contact: ContactData
  /** ISO timestamp set when the service-branch consent is checked. */
  consentAt: string | null
}

export interface WizardServiceOption {
  key: string
  label: string
  hint: string
  branch: WizardBranch
  saleObjectType?: SaleObjectType
  serviceType?: ServiceRequestType
}

/** The five step-1 services fixed by the spec. */
export const WIZARD_SERVICES: readonly WizardServiceOption[] = [
  {
    key: 'sale:raieoigus',
    label: 'Raieõiguse müük',
    hint: 'Müü metsa raiemahu õigus oksjonil.',
    branch: 'sale',
    saleObjectType: 'raieoigus',
  },
  {
    key: 'sale:kinnistu',
    label: 'Kinnistu müük',
    hint: 'Müü metsamaa kinnistu oksjonil.',
    branch: 'sale',
    saleObjectType: 'kinnistu',
  },
  {
    key: 'service:kava',
    label: 'Metsamajanduskava',
    hint: 'Telli metsa majanduskava.',
    branch: 'service',
    serviceType: 'kava',
  },
  {
    key: 'service:hooldusraie',
    label: 'Hooldusraie',
    hint: 'Telli hooldus- või valgusraie.',
    branch: 'service',
    serviceType: 'hooldusraie',
  },
  {
    key: 'service:istutamine',
    label: 'Metsa istutamine',
    hint: 'Telli metsa istutamine või istikud.',
    branch: 'service',
    serviceType: 'istutamine',
  },
]

export function findServiceOption(key: string | null): WizardServiceOption | null {
  if (key === null) return null
  return WIZARD_SERVICES.find((option) => option.key === key) ?? null
}

/**
 * Submission boundary for task 3.3: the summary step calls this with the
 * full wizard state. The submitter POSTs to /api/v1/object-submissions
 * (sale, uploading files first) or /api/v1/service-requests (service).
 */
export type SubmitWizardHandler = (data: ObjectWizardData) => void | Promise<void>

export interface ObjectWizardProps {
  contactPrefill: ContactPrefill
  onSubmit: SubmitWizardHandler
  submitting?: boolean
  submitError?: string | null
}
