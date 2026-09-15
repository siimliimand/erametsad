import { splitCadastreInput, type ServiceRequestType } from '@erametsad/types'
import type { ZodError } from 'zod'

import type { ObjectWizardData, StepErrors, WizardStepId } from './types'

import {
  saleSubmissionSchema,
  serviceSubmissionSchema,
} from '@/lib/object-submission'


/**
 * Step validation against the shared submission schemas (design D5): every
 * "Edasi" parses a full branch payload with saleSubmissionSchema or
 * serviceSubmissionSchema and keeps only the issues that belong to the
 * current step's fields, so the client cannot drift from the server rules.
 */

/** Mirrors the sale upload endpoint's server-side rules (task 2.3). */
export const SALE_FILE_MAX_COUNT = 10
export const SALE_FILE_MAX_BYTES = 10 * 1024 * 1024
export const SALE_FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png'

const STEP_FIELDS: Partial<Record<WizardStepId, readonly string[]>> = {
  location: ['cadastres', 'county', 'address'],
  'object-data': ['areaHa', 'species', 'loggingTypes', 'volumeM3'],
  files: ['files'],
  description: ['description'],
  'service-details': [
    'type',
    'cadastres',
    'county',
    'provisions',
    'services',
    'paper_copy',
    'comment',
  ],
}

function ownsKey(step: WizardStepId, key: string): boolean {
  if (step === 'contact') return key.startsWith('contact.')
  const fields = STEP_FIELDS[step]
  if (!fields) return false
  return fields.some((field) => key === field || key.startsWith(`${field}.`))
}

/** First message per field; array paths collapse to the field key. */
function issuesToErrors(error: ZodError): StepErrors {
  const errors: StepErrors = {}
  for (const issue of error.issues) {
    const rawPath = issue.path.map(String).join('.')
    const key = rawPath.replace(/\.\d+$/g, '') || 'form'
    if (!(key in errors)) errors[key] = issue.message
  }
  return errors
}

function numberOrRaw(value: string): number | string | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const parsed = Number(trimmed)
  return Number.isNaN(parsed) ? trimmed : parsed
}

function salePayload(data: ObjectWizardData): Record<string, unknown> {
  const { sale, contact } = data
  const county = sale.county.trim()
  const address = sale.address.trim()
  const payload: Record<string, unknown> = {
    branch: 'sale',
    objectType: sale.objectType,
    cadastres: splitCadastreInput(sale.cadastreInput),
    areaHa: numberOrRaw(sale.areaHa),
    species: sale.species,
    loggingTypes: sale.loggingTypes,
    description: sale.description,
    contact: {
      name: contact.name.trim(),
      email: contact.email.trim(),
      phone: contact.phone.trim(),
    },
  }
  if (county !== '') payload.county = county
  if (address !== '') payload.address = address
  const volume = numberOrRaw(sale.volumeM3)
  if (volume !== undefined) payload.volumeM3 = volume
  return payload
}

function servicePayload(data: ObjectWizardData): Record<string, unknown> {
  const { service, contact } = data
  const payload: Record<string, unknown> = {
    branch: 'service',
    type: service.serviceType,
    contact: {
      name: contact.name.trim(),
      email: contact.email.trim(),
      phone: contact.phone.trim(),
    },
    cadastres: service.cadastreInput,
  }
  if (service.serviceType === 'kava') {
    if (service.paperCopy) payload.paper_copy = true
  } else {
    payload.county = service.county
    payload.provisions = service.provisions
    payload.services = service.services
  }
  const comment = service.comment.trim()
  if (comment !== '') payload.comment = comment
  return payload
}

function branchErrors(data: ObjectWizardData): StepErrors {
  if (data.branch === 'sale') {
    const parsed = saleSubmissionSchema.safeParse(salePayload(data))
    return parsed.success ? {} : issuesToErrors(parsed.error)
  }
  const parsed = serviceSubmissionSchema.safeParse(servicePayload(data))
  return parsed.success ? {} : issuesToErrors(parsed.error)
}

function isAllowedSaleFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return (
    name.endsWith('.pdf') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    file.type === 'application/pdf' ||
    file.type.startsWith('image/')
  )
}

/** Client-side pre-check for the sale multi-upload; the server re-checks. */
function saleFileErrors(files: readonly File[]): StepErrors {
  if (files.length > SALE_FILE_MAX_COUNT) {
    return { files: `Lisa kuni ${String(SALE_FILE_MAX_COUNT)} faili.` }
  }
  const oversized = files.find((file) => file.size > SALE_FILE_MAX_BYTES)
  if (oversized) {
    return { files: `"${oversized.name}" on liiga suur (max 10 MB).` }
  }
  const wrongType = files.find((file) => !isAllowedSaleFile(file))
  if (wrongType) {
    return { files: `"${wrongType.name}" — lubatud on pildid ja PDF-failid.` }
  }
  return {}
}

export function validateStep(step: WizardStepId, data: ObjectWizardData): StepErrors {
  if (step === 'service') {
    const selected =
      data.branch === 'sale' ? data.sale.objectType : data.service.serviceType
    return selected === null ? { service: 'Vali teenus, et jätkata.' } : {}
  }
  if (step === 'files') {
    return saleFileErrors(data.sale.files)
  }
  const errors = branchErrors(data)
  if (step === 'summary') {
    if (data.branch === 'service' && data.consentAt === null) {
      errors.consentAt = 'Nõusolek on kohustuslik'
    }
    return errors
  }
  return Object.fromEntries(
    Object.entries(errors).filter(([key]) => ownsKey(step, key)),
  )
}

export function serviceTypeLabel(type: ServiceRequestType): string {
  const labels: Record<ServiceRequestType, string> = {
    kava: 'Metsamajanduskava',
    hooldusraie: 'Hooldusraie',
    istutamine: 'Metsa istutamine',
  }
  return labels[type]
}
