import { serviceRequestPayloadSchema, type ServiceRequestPayload } from '@erametsad/types'
import { drizzle } from 'drizzle-orm/d1'

import { selectPartners } from './routing'
import { computeIpHash } from '../bidding/place-bid'
import {
  createPartnersRepository,
  createServiceRequestsRepository,
  type PartnersRepository,
  type ServiceRequestDoc,
  type ServiceRequestsRepository,
} from '../data/repositories'
import * as schema from '../data/schema'
import { getD1Database } from '../db'
import { validateHoneypot } from '../leads/ingestion'

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000

/** Honeypot hit: callers answer with a neutral success, never a row. */
export class HoneypotTriggeredError extends Error {
  constructor() {
    super('honeypot triggered')
    this.name = 'HoneypotTriggeredError'
  }
}

/** Payload failed the shared per-type schemas; message is user-facing (et). */
export class ServiceRequestValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServiceRequestValidationError'
  }
}

/** Same phone + cadastral unit within the throttle window (user-facing et). */
export class DuplicateServiceRequestError extends Error {
  constructor() {
    super('Päring on juba saadetud')
    this.name = 'DuplicateServiceRequestError'
  }
}

export interface ServiceRequestInput {
  /** Raw request body, validated and normalized with the shared zod schemas. */
  body: Record<string, unknown>
  formName: string
  pageSlug?: string
  consentAt: string
  /** Caller IP; hashed with the shared computeIpHash before storage. */
  requestIp?: string
  /** R2 object keys of uploaded attachments, persisted to the row. */
  attachments?: string[]
}

export interface IngestServiceRequestResult {
  request: ServiceRequestDoc
  routedCount: number
}

export interface ServiceRequestServices {
  serviceRequests: ServiceRequestsRepository
  partners: PartnersRepository
}

// Same widening as runtime.ts: the D1 drizzle instance satisfies CoreDatabase.
async function defaultServices(): Promise<ServiceRequestServices> {
  const d1 = await getD1Database()
  const database = drizzle(d1 as unknown as Parameters<typeof drizzle>[0], { schema })
  return {
    serviceRequests: createServiceRequestsRepository(database),
    partners: createPartnersRepository(database),
  }
}

export async function ingestServiceRequest(
  input: ServiceRequestInput,
  services?: ServiceRequestServices,
): Promise<IngestServiceRequestResult> {
  if (!input.consentAt) {
    throw new Error('consentAt is required')
  }

  const repos = services ?? (await defaultServices())

  if (!validateHoneypot(input.body)) {
    throw new HoneypotTriggeredError()
  }

  const parsed = serviceRequestPayloadSchema.safeParse(input.body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message
    throw new ServiceRequestValidationError(first ?? 'Sisestus on vigane')
  }
  const payload: ServiceRequestPayload = parsed.data

  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString()
  for (const cadastre of payload.cadastres) {
    const recent = await repos.serviceRequests.countRecentByPhoneAndCadastre(
      payload.contact.phone,
      cadastre,
      since,
    )
    if (recent > 0) {
      throw new DuplicateServiceRequestError()
    }
  }

  const activePartners = await repos.partners.listActive()
  const county = 'county' in payload ? payload.county : null
  const matched = selectPartners(activePartners, payload.type, county)

  const request = await repos.serviceRequests.create({
    type: payload.type,
    // `phone` is denormalized to the top level: countRecentByPhoneAndCadastre
    // reads json_extract(payload, '$.phone') per the repository contract.
    payload: { ...payload, phone: payload.contact.phone },
    routedTo: matched.map((partner) => partner.id),
    status: matched.length > 0 ? 'routed' : 'new',
    ...(input.attachments && input.attachments.length > 0
      ? { attachments: input.attachments }
      : {}),
    consentAt: input.consentAt,
    formName: input.formName,
    pageSlug: input.pageSlug ?? '',
    ipHash: input.requestIp ? computeIpHash(input.requestIp) : null,
  })

  return { request, routedCount: matched.length }
}
