import { getRepositories } from '../data/runtime'
import { deriveCountyCodeFromCadastre } from './cadastre-county'

export interface LeadInput {
  formName: string
  pageSlug?: string
  contactName: string
  phone: string
  email: string
  cadastr?: string
  consentAt: string
  source?: string
  ipHash?: string
}

export function validateHoneypot(body: Record<string, unknown>): boolean {
  return !body.company_website || (body.company_website as string).trim() === ''
}

export async function ingestLead(data: LeadInput): Promise<Record<string, unknown>> {
  if (!data.consentAt) {
    throw new Error('consentAt is required')
  }

  const repos = await getRepositories()

  const countyCode = deriveCountyCodeFromCadastre(data.cadastr)
  let countyId: string | null = null
  if (countyCode) {
    const { docs } = await repos.find({
      collection: 'counties',
      where: { code: { equals: countyCode } },
      limit: 1,
    })
    countyId = docs[0]?.id ?? null
  }

  const doc = await repos.create({
    collection: 'leads',
    data: {
      formName: data.formName,
      pageSlug: data.pageSlug ?? '',
      contactName: data.contactName,
      phone: data.phone,
      email: data.email,
      cadastr: data.cadastr ?? '',
      countyId,
      consentAt: data.consentAt,
      source: data.source ?? 'web',
      ipHash: data.ipHash ?? null,
      status: 'new',
    },
  })

  return doc
}