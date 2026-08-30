import { getRepositories } from '../data/runtime'

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

  const doc = await repos.create({
    collection: 'leads',
    data: {
      formName: data.formName,
      pageSlug: data.pageSlug ?? '',
      contactName: data.contactName,
      phone: data.phone,
      email: data.email,
      cadastr: data.cadastr ?? '',
      consentAt: data.consentAt,
      source: data.source ?? 'web',
      ipHash: data.ipHash ?? null,
      status: 'new',
    },
  })

  return doc
}