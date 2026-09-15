import { slugifyTitle } from '@/app/(admin)/admin/auctions/_lib/auction-schema'
import {
  countyRoundRobinPick,
  type CountyRoundRobinCandidate,
} from '@/app/(admin)/admin/leads/_components/lead-flow'
import type { CoreRepositories } from '@/lib/data/repositories'
import type { AuctionDoc } from '@/lib/data/repositories/registry'
import { getRepositories } from '@/lib/data/runtime'
import type { Lead } from '@/lib/data/schema'
import { eventBus, type DomainEvent } from '@/lib/notifications/event-bus'
import { deriveSaleCounty, type SaleObjectType, type SaleSubmission } from '@/lib/object-submission'

/**
 * Sale branch ingestion (change portal-object-submission, design D1/D3/D4):
 * one owned draft auction plus one portal-sourced lead, county round-robin
 * specialist assignment on both, and append-only audit entries for the
 * creates. Kept free of HTTP so the route stays thin and the logic runs
 * against the SQLite test pool through the `services?` seam.
 */

export const SALE_OBJECT_TYPE_LABELS: Readonly<Record<SaleObjectType, string>> = {
  raieoigus: 'Raieõiguse müük',
  kinnistu: 'Kinnistu müük',
}

/** Mechanics default by object type (design D7). */
export function saleAuctionType(objectType: SaleObjectType): 'open' | 'sealed' {
  return objectType === 'kinnistu' ? 'sealed' : 'open'
}

/** Server-generated title: product label plus the first cadastre. */
export function generateSaleTitle(objectType: SaleObjectType, cadastres: readonly string[]): string {
  const cadastre = cadastres[0] ?? ''
  return cadastre === ''
    ? SALE_OBJECT_TYPE_LABELS[objectType]
    : `${SALE_OBJECT_TYPE_LABELS[objectType]} ${cadastre}`
}

/** Same convention as the admin wizard's alias generator. */
export function generateAliasEmail(): string {
  return `mt${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}@oksjonid.erametsad.ee`
}

async function uniqueSlug(repositories: CoreRepositories, base: string): Promise<string> {
  let candidate = base
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await repositories.find({
      collection: 'auctions',
      where: { slug: { equals: candidate } },
      limit: 1,
    })
    if (existing.docs.length === 0) return candidate
    candidate = `${base}-${crypto.randomUUID().slice(0, 8)}`
  }
  return `${base}-${Date.now().toString(36)}`
}

/** Counties row id for a derived two-letter county code, or null when unknown. */
export async function resolveCountyId(
  repositories: CoreRepositories,
  countyCode: string | null,
): Promise<string | null> {
  if (!countyCode) return null
  const { docs } = await repositories.find({
    collection: 'counties',
    where: { code: { equals: countyCode } },
    limit: 1,
  })
  return docs[0]?.id ?? null
}

export interface SaleBranchServices {
  repositories: CoreRepositories
  /**
   * Notification sink; defaults to the shared event bus so tests can inject
   * a spy and assert the emissions without a real dispatcher.
   */
  notifications?: { emit(event: DomainEvent): void }
}

async function defaultServices(): Promise<SaleBranchServices> {
  return { repositories: await getRepositories(), notifications: eventBus }
}

export interface IngestSaleSubmissionResult {
  auction: AuctionDoc
  lead: Lead
  /** Round-robin pick; null when no active specialist exists (best-effort). */
  assignedSpecialistId: string | null
}

/**
 * Candidate roster for the county round-robin: active specialists with the
 * count of leads already assigned to them in the target county (all leads
 * when the county is unknown), fewest first per the helper's contract.
 */
export async function pickCountySpecialist(
  repositories: CoreRepositories,
  countyId: string | null,
): Promise<string | null> {
  const { docs: specialists } = await repositories.find({
    collection: 'specialists',
    sort: 'name',
    pagination: false,
  })
  const { docs: countyLeads } = await repositories.find({
    collection: 'leads',
    ...(countyId ? { where: { countyId: { equals: countyId } } } : {}),
    pagination: false,
  })
  const countsBySpecialist = new Map<string, number>()
  for (const lead of countyLeads) {
    if (!lead.assignedSpecialistId) continue
    countsBySpecialist.set(
      lead.assignedSpecialistId,
      (countsBySpecialist.get(lead.assignedSpecialistId) ?? 0) + 1,
    )
  }
  const candidates: CountyRoundRobinCandidate[] = specialists.map((specialist) => ({
    id: specialist.id,
    active: specialist.active,
    countyLeadCount: countsBySpecialist.get(specialist.id) ?? 0,
  }))
  return countyRoundRobinPick(candidates)?.id ?? null
}

export async function ingestSaleSubmission(
  input: SaleSubmission,
  sellerId: string,
  services?: SaleBranchServices,
): Promise<IngestSaleSubmissionResult> {
  const { repositories, notifications = eventBus } = services ?? (await defaultServices())

  // The derived code wins over the (optional, wizard-prefilled) payload
  // county; the payload value only backs the derivation up when the first
  // cadastre maps to nothing.
  const countyCode = deriveSaleCounty(input.cadastres) ?? input.county ?? null
  const countyId = await resolveCountyId(repositories, countyCode)
  const assignedSpecialistId = await pickCountySpecialist(repositories, countyId)

  const nowIso = new Date().toISOString()
  const title = generateSaleTitle(input.objectType, input.cadastres)
  const slug = await uniqueSlug(repositories, slugifyTitle(title))
  const aliasEmail = generateAliasEmail()

  const auction = await repositories.create({
    collection: 'auctions',
    data: {
      title,
      slug,
      status: 'draft',
      objectType: input.objectType,
      type: saleAuctionType(input.objectType),
      ...(countyId ? { county: countyId } : {}),
      ...(input.address ? { address: input.address } : {}),
      cadastres: [...input.cadastres],
      species: [...input.species],
      loggingTypes: [...input.loggingTypes],
      areaHa: input.areaHa,
      ...(input.volumeM3 !== undefined ? { volumeM3: input.volumeM3 } : {}),
      // Placeholder per design D6; the publish gate (task 2.4) blocks 0.
      minBidCents: 0,
      descriptionPublic: input.description,
      files: [...(input.files ?? [])],
      aliasEmail,
      sellerId,
      ...(assignedSpecialistId ? { specialistId: assignedSpecialistId } : {}),
    },
  })

  const lead = await repositories.create({
    collection: 'leads',
    data: {
      formName: 'Portaal: objekti pakkumine',
      pageSlug: '/user/objects/paku',
      contactName: input.contact.name,
      phone: input.contact.phone,
      email: input.contact.email,
      cadastr: input.cadastres[0] ?? '',
      countyId,
      consentAt: nowIso,
      source: 'portal',
      status: 'new',
      assignedSpecialistId,
      userId: sellerId,
      auctionId: auction.id,
    },
  })

  await repositories.create({
    collection: 'audit-entry',
    data: {
      actorId: sellerId,
      action: 'auction.create_portal',
      entityType: 'auction',
      entityId: auction.id,
      after: {
        title,
        objectType: input.objectType,
        type: auction.type,
        status: 'draft',
        sellerId,
        minBidCents: 0,
        assignedSpecialistId,
      },
    },
  })
  await repositories.create({
    collection: 'audit-entry',
    data: {
      actorId: sellerId,
      action: 'lead.create_portal',
      entityType: 'lead',
      entityId: lead.id,
      after: {
        contactName: input.contact.name,
        source: 'portal',
        auctionId: auction.id,
        assignedSpecialistId,
        assignment: assignedSpecialistId ? 'auto' : 'none',
      },
    },
  })

  // Emitted only after every row succeeded (same as place-bid). Dispatch
  // errors are swallowed inside the notification service, so a failed
  // notification never fails the submission.
  notifications.emit({
    type: 'submission.received',
    userId: sellerId,
    payload: { objectTitle: title },
  })
  if (assignedSpecialistId !== null) {
    notifications.emit({
      type: 'submission.new',
      userId: assignedSpecialistId,
      payload: { objectTitle: title, submitterName: input.contact.name },
    })
  }

  return { auction, lead, assignedSpecialistId }
}
