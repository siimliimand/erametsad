'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'

import {
  approveAlapakkumine,
  rejectAlapakkumine,
  type ApproveDecision,
  type RejectDecision,
} from '@/lib/bidding/alapakkumine'
import {
  approveOpeningSession,
  confirmWinner,
  startOpeningSession,
  voidOpening,
} from '@/lib/bidding/sealed-opening'
import { prepareContract } from '@/lib/contracts/service'
import type { CoreRepositories } from '@/lib/data/repositories'
import { auctionObjectTypes } from '@/lib/data/schema'

const newAuctionPath = '/admin/auctions/new'

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function readOptionalText(formData: FormData, key: string): string | null {
  const value = readText(formData, key)
  return value === '' ? null : value
}

function readOptionalDatetime(formData: FormData, key: string): string | null {
  const value = readText(formData, key)
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function readMoneyCents(formData: FormData, key: string): { cents: number | null; invalid: boolean } {
  const text = readText(formData, key).replace(',', '.')
  if (!text) return { cents: null, invalid: false }
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0) return { cents: null, invalid: true }
  return { cents: Math.round(value * 100), invalid: false }
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?viga=${encodeURIComponent(message)}`)
}

function auctionDetailPath(auctionId: string): string {
  return `/admin/auctions/${auctionId}`
}

function audit(
  repositories: CoreRepositories,
  entry: { actorId: string; action: string; entityType: string; entityId: string; after: unknown },
): Promise<unknown> {
  return repositories.create({
    collection: 'audit-entry',
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      after: entry.after,
    },
  })
}

export async function createAuctionAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const title = readText(formData, 'title')
  const slug = readText(formData, 'slug')
  const objectType = readText(formData, 'objectType')
  const type = readText(formData, 'type') === 'sealed' ? ('sealed' as const) : ('open' as const)
  const minBid = readMoneyCents(formData, 'minBidEur')
  const bidStep = readMoneyCents(formData, 'bidStepEur')
  const reservePrice = readMoneyCents(formData, 'reservePriceEur')

  if (!title) redirectWithError(newAuctionPath, 'Pealkiri on kohustuslik.')
  if (!slug) redirectWithError(newAuctionPath, 'URL-nimi on kohustuslik.')
  if (!auctionObjectTypes.includes(objectType as (typeof auctionObjectTypes)[number])) {
    redirectWithError(newAuctionPath, 'Vali sobiv objekti tüüp.')
  }
  if (minBid.cents === null || minBid.invalid) {
    redirectWithError(newAuctionPath, 'Lähtehind peab olema mitte negatiivne number.')
  }
  if (bidStep.invalid) {
    redirectWithError(newAuctionPath, 'Pakkumise samm peab olema mitte negatiivne number.')
  }
  if (reservePrice.invalid) {
    redirectWithError(newAuctionPath, 'Reservhind peab olema mitte negatiivne number.')
  }

  let failure: string | null = null
  try {
    await repositories.create({
      collection: 'auctions',
      data: {
        title,
        slug,
        status: 'draft',
        objectType: objectType as (typeof auctionObjectTypes)[number],
        type,
        minBidCents: minBid.cents,
        ...(bidStep.cents !== null ? { bidStepCents: bidStep.cents } : {}),
        ...(reservePrice.cents !== null ? { reservePriceCents: reservePrice.cents } : {}),
        startsAt: readOptionalDatetime(formData, 'startsAt'),
        endsAt: readOptionalDatetime(formData, 'endsAt'),
        descriptionPublic: readOptionalText(formData, 'descriptionPublic'),
        address: readOptionalText(formData, 'address'),
        countyId: readOptionalText(formData, 'countyId'),
        parishId: readOptionalText(formData, 'parishId'),
        specialistId: readOptionalText(formData, 'specialistId'),
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(newAuctionPath, `Oksjoni loomine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/auctions')
  redirect('/admin/auctions')
}

export async function updateAuctionAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  const detailPath = auctionDetailPath(id)
  const editPath = `${detailPath}/edit`
  if (!id) redirectWithError('/admin/auctions', 'Muudatuseks puudub oksjoni identifikaator.')

  const title = readText(formData, 'title')
  const objectType = readText(formData, 'objectType')
  const type = readText(formData, 'type') === 'sealed' ? ('sealed' as const) : ('open' as const)
  const minBid = readMoneyCents(formData, 'minBidEur')
  const bidStep = readMoneyCents(formData, 'bidStepEur')
  const reservePrice = readMoneyCents(formData, 'reservePriceEur')

  if (!title) redirectWithError(editPath, 'Pealkiri on kohustuslik.')
  if (!auctionObjectTypes.includes(objectType as (typeof auctionObjectTypes)[number])) {
    redirectWithError(editPath, 'Vali sobiv objekti tüüp.')
  }
  if (minBid.cents === null || minBid.invalid) {
    redirectWithError(editPath, 'Lähtehind peab olema mitte negatiivne number.')
  }
  if (bidStep.invalid) {
    redirectWithError(editPath, 'Pakkumise samm peab olema mitte negatiivne number.')
  }
  if (reservePrice.invalid) {
    redirectWithError(editPath, 'Reservhind peab olema mitte negatiivne number.')
  }

  const startsAt = readOptionalDatetime(formData, 'startsAt')
  const endsAt = readOptionalDatetime(formData, 'endsAt')
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    redirectWithError(editPath, 'Lõppaeg peab olema pärast algusaega.')
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'auctions',
      id,
      data: {
        title,
        objectType: objectType as (typeof auctionObjectTypes)[number],
        type,
        minBidCents: minBid.cents,
        ...(bidStep.cents !== null ? { bidStepCents: bidStep.cents } : {}),
        ...(reservePrice.cents !== null ? { reservePriceCents: reservePrice.cents } : {}),
        startsAt,
        endsAt,
        descriptionPublic: readOptionalText(formData, 'descriptionPublic'),
        address: readOptionalText(formData, 'address'),
        countyId: readOptionalText(formData, 'countyId'),
        parishId: readOptionalText(formData, 'parishId'),
        specialistId: readOptionalText(formData, 'specialistId'),
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(editPath, `Oksjoni salvestamine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/auctions')
  revalidatePath(detailPath)
  redirect(detailPath)
}

export async function deleteAuctionAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError('/admin/auctions', 'Kustutamiseks puudub oksjoni identifikaator.')

  let failure: string | null = null
  try {
    await repositories.delete({ collection: 'auctions', id })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError('/admin/auctions', `Oksjoni kustutamine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/auctions')
  redirect('/admin/auctions')
}

// Minimal DO namespace surface (same local-declaration approach as
// src/app/api/v1/bids/create/route.ts, so actions never import
// cloudflare:workers).
interface AuctionDoNamespace {
  idFromName(name: string): unknown
  get(id: unknown): { fetch(input: string, init?: RequestInit): Promise<Response> }
}

/**
 * Tells the AuctionDO to re-hydrate and broadcast `auction:published`.
 * Best-effort: without the AUCTION binding (plain next dev) the D1 status
 * change stands on its own and the broadcast is simply skipped.
 */
async function broadcastAuctionPublished(auctionId: string): Promise<void> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const context = await getCloudflareContext({ async: true })
    const namespace = (context.env as { AUCTION?: AuctionDoNamespace }).AUCTION
    if (!namespace) return
    const stub = namespace.get(namespace.idFromName(auctionId))
    await stub.fetch(`https://auction-do/${auctionId}/publish`, { method: 'POST' })
  } catch {
    // The publish transition already committed in D1.
  }
}

export async function publishAuctionAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError('/admin/auctions', 'Avalikustamiseks puudub oksjoni identifikaator.')
  const detailPath = auctionDetailPath(id)

  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')

  if (auction.status !== 'draft' && auction.status !== 'scheduled') {
    redirectWithError(detailPath, 'Avalikustada saab ainult mustandit või ajastatud oksjoni.')
  }
  if (!auction.startsAt || !auction.endsAt) {
    redirectWithError(detailPath, 'Avalikustamiseks määra oksjonile algus- ja lõppaeg.')
  }
  if (Date.parse(auction.endsAt) <= Date.parse(auction.startsAt)) {
    redirectWithError(detailPath, 'Lõppaeg peab olema pärast algusaega.')
  }
  if (Date.parse(auction.endsAt) <= Date.now()) {
    redirectWithError(detailPath, 'Lõppaeg peab olema tulevikus.')
  }

  const nowIso = new Date().toISOString()
  const target = Date.parse(auction.startsAt) > Date.now() ? 'scheduled' : 'active'

  let failure: string | null = null
  try {
    // draft -> active must pass through scheduled; the guard chain is
    // draft -> scheduled -> active and each update is one step.
    if (auction.status === 'draft' && target === 'active') {
      await repositories.update({
        collection: 'auctions',
        id,
        data: { status: 'scheduled', scheduledAt: auction.startsAt },
      })
    }
    await repositories.update({
      collection: 'auctions',
      id,
      data:
        target === 'scheduled'
          ? { status: 'scheduled', scheduledAt: auction.startsAt }
          : { status: 'active', activatedAt: nowIso },
    })
    await audit(repositories, {
      actorId: session.userId,
      action: 'auction_published',
      entityType: 'auction',
      entityId: id,
      after: { status: target },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(detailPath, `Avalikustamine ebaõnnestus: ${failure}`)
  }

  await broadcastAuctionPublished(id)

  revalidatePath('/admin/auctions')
  revalidatePath(detailPath)
  redirect(
    `${detailPath}?teade=${encodeURIComponent(
      target === 'scheduled' ? 'Oksjon ajastatud ja avalikustatud.' : 'Oksjon on aktiivne.',
    )}`,
  )
}

function decisionFailure(outcome: string, action: string): string {
  switch (outcome) {
    case 'bid_not_found':
      return 'Pakkumust ei leitud.'
    case 'auction_not_found':
      return 'Oksjonit ei leitud.'
    case 'auction_not_active':
      return 'Oksjon pole aktiivne; alapakkumuse otsustamine pole enam lubatud.'
    default:
      return `Pakkumuse ${action} ebaõnnestus.`
  }
}

export async function approveAuctionBidAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const auctionId = readText(formData, 'auctionId')
  const bidId = readText(formData, 'bidId')
  if (!auctionId || !bidId) {
    redirectWithError('/admin/auctions', 'Pakkumuse otsustamiseks puudub identifikaator.')
  }
  const detailPath = auctionDetailPath(auctionId)

  const decision: ApproveDecision = await approveAlapakkumine(auctionId, bidId)
  if (decision.outcome !== 'approved') {
    redirectWithError(
      detailPath,
      decision.outcome === 'not_pending'
        ? `Pakkumus ei ole enam kinnitamisel (hetke olek: ${decision.status}).`
        : decisionFailure(decision.outcome, 'kinnitamine'),
    )
  }

  await audit(repositories, {
    actorId: session.userId,
    action: 'bid_approved',
    entityType: 'bid',
    entityId: bidId,
    after: { auctionId },
  })

  revalidatePath(detailPath)
  redirect(`${detailPath}?teade=${encodeURIComponent('Alapakkumus kinnitatud ja juhtivaks seatud.')}`)
}

export async function rejectAuctionBidAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const auctionId = readText(formData, 'auctionId')
  const bidId = readText(formData, 'bidId')
  if (!auctionId || !bidId) {
    redirectWithError('/admin/auctions', 'Pakkumuse otsustamiseks puudub identifikaator.')
  }
  const detailPath = auctionDetailPath(auctionId)

  const decision: RejectDecision = await rejectAlapakkumine(auctionId, bidId)
  if (decision.outcome !== 'rejected') {
    redirectWithError(
      detailPath,
      decision.outcome === 'not_pending'
        ? `Pakkumus ei ole enam kinnitamisel (hetke olek: ${decision.status}).`
        : decisionFailure(decision.outcome, 'tagasilükkamine'),
    )
  }

  await audit(repositories, {
    actorId: session.userId,
    action: 'bid_rejected',
    entityType: 'bid',
    entityId: bidId,
    after: { auctionId },
  })

  revalidatePath(detailPath)
  redirect(`${detailPath}?teade=${encodeURIComponent('Alapakkumus tagasi lükatud.')}`)
}

export async function generateContractAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const auctionId = readText(formData, 'auctionId')
  if (!auctionId) {
    redirectWithError('/admin/auctions', 'Lepingu koostamiseks puudub oksjoni identifikaator.')
  }
  const detailPath = auctionDetailPath(auctionId)

  const auction = await repositories.findByID({ collection: 'auctions', id: auctionId })
  if (!auction) redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  if (auction.status !== 'appraised') {
    redirectWithError(detailPath, 'Lepingu saab koostada ainult hinnatud (võitjaga) oksjonile.')
  }

  let failure: string | null = null
  let contractId = ''
  try {
    const contract = await prepareContract(auctionId, 'auction')
    contractId = contract.id
    await audit(repositories, {
      actorId: session.userId,
      action: 'contract_generated',
      entityType: 'auction',
      entityId: auctionId,
      after: { contractId },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(detailPath, `Lepingu koostamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(detailPath)
  redirect(
    `${detailPath}?teade=${encodeURIComponent(`Leping ${contractId} koostatud.`)}`,
  )
}

export interface RevealedBidView {
  id: string
  amount: number
  createdAt: string
  valid: boolean
}

export interface CeremonyState {
  phase: 'start' | 'awaiting-approval' | 'revealed' | 'confirmed'
  sessionId: string | null
  approvalToken: string | null
  bids: RevealedBidView[]
  error: string | null
}

async function adminAccessToken(): Promise<string | null> {
  return (await cookies()).get('access_token')?.value ?? null
}

export async function startSealedCeremonyAction(
  _prev: CeremonyState,
  formData: FormData,
): Promise<CeremonyState> {
  await requireAdminRepositories()

  const auctionId = readText(formData, 'auctionId')
  if (!auctionId) {
    return { phase: 'start', sessionId: null, approvalToken: null, bids: [], error: 'Oksjoni identifikaator puudub.' }
  }

  const token = await adminAccessToken()
  if (!token) {
    return { phase: 'start', sessionId: null, approvalToken: null, bids: [], error: 'Sisselogimise token puudub.' }
  }

  try {
    const session = await startOpeningSession(auctionId, token)
    return {
      phase: 'awaiting-approval',
      sessionId: session.sessionId,
      approvalToken: session.approvalToken,
      bids: [],
      error: null,
    }
  } catch (error) {
    return {
      phase: 'start',
      sessionId: null,
      approvalToken: null,
      bids: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function approveSealedCeremonyAction(
  _prev: CeremonyState,
  formData: FormData,
): Promise<CeremonyState> {
  await requireAdminRepositories()

  const sessionId = readText(formData, 'sessionId')
  const approvalToken = readText(formData, 'approvalToken')
  if (!sessionId || !approvalToken) {
    return { phase: 'start', sessionId: null, approvalToken: null, bids: [], error: 'Sessioon või kinnituseluba puudub.' }
  }

  const token = await adminAccessToken()
  if (!token) {
    return { phase: 'start', sessionId: null, approvalToken: null, bids: [], error: 'Sisselogimise token puudub.' }
  }

  try {
    const result = await approveOpeningSession(sessionId, approvalToken, token)
    // Anonymity: only rank-relevant fields travel to the screen, never the
    // bidder identity or identity snapshot.
    const bids: RevealedBidView[] = result.bids.map((bid) => ({
      id: bid.id,
      amount: bid.amount,
      createdAt: bid.createdAt,
      valid: bid.valid,
    }))
    return { phase: 'revealed', sessionId, approvalToken, bids, error: null }
  } catch (error) {
    return {
      phase: 'awaiting-approval',
      sessionId,
      approvalToken,
      bids: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function confirmSealedWinnerAction(
  _prev: CeremonyState,
  formData: FormData,
): Promise<CeremonyState> {
  await requireAdminRepositories()

  const auctionId = readText(formData, 'auctionId')
  const bidId = readText(formData, 'bidId')
  const sessionId = readText(formData, 'sessionId')
  const approvalToken = readText(formData, 'approvalToken')
  if (!auctionId || !bidId) {
    return { phase: 'revealed', sessionId, approvalToken, bids: [], error: 'Oksjoni või pakkumuse identifikaator puudub.' }
  }

  const token = await adminAccessToken()
  if (!token) {
    return { phase: 'revealed', sessionId, approvalToken, bids: [], error: 'Sisselogimise token puudub.' }
  }

  try {
    await confirmWinner(auctionId, bidId, token)
    return { phase: 'confirmed', sessionId, approvalToken, bids: [], error: null }
  } catch (error) {
    return {
      phase: 'revealed',
      sessionId,
      approvalToken,
      bids: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function voidSealedCeremonyAction(formData: FormData): Promise<void> {
  await requireAdminRepositories()

  const auctionId = readText(formData, 'auctionId')
  if (!auctionId) {
    redirectWithError('/admin/auctions', 'Tühistamiseks puudub oksjoni identifikaator.')
  }
  const detailPath = auctionDetailPath(auctionId)

  let failure: string | null = null
  try {
    await voidOpening(auctionId)
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(`${detailPath}/ceremony`, `Avamise tühistamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(detailPath)
  revalidatePath(`${detailPath}/ceremony`)
  redirect(`${detailPath}?teade=${encodeURIComponent('Pitseeritud avamine tühistatud; oksjon kuulutatud müümata.')}`)
}
