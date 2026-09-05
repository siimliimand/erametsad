'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'
import { auctionStatusLabels } from '../_lib/labels'
import {
  assertCan,
  auctionInScope,
  auctionScope,
  PermissionDeniedError,
  type StaffRole,
} from '../_lib/permissions'
import {
  applyQuickAuctionDefaults,
  auctionInputSchema,
  collectPublishGateFailures,
  slugifyTitle,
  toAuctionWriteData,
  type AuctionInput,
  type AuctionWriteData,
} from '../admin/auctions/_lib/auction-schema'
import { tallinnWallTimeToUtcIso } from '../admin/content/_components/scheduled-publish'

import { verifyAdminAccessToken } from '@/lib/auth/jwt'
import { verifyPassword } from '@/lib/auth/password'
import {
  approveAlapakkumine,
  rejectAlapakkumine,
  type ApproveDecision,
  type RejectDecision,
} from '@/lib/bidding/alapakkumine'
import {
  decryptSealedBids,
  getSealedBidsForAuction,
  type DecryptedBid,
} from '@/lib/bidding/sealed-bid'
import {
  approveOpeningSession,
  confirmWinner,
  startOpeningSession,
} from '@/lib/bidding/sealed-opening'
import { createCache } from '@/lib/cache'
import { prepareContract } from '@/lib/contracts/service'
import type { AuctionDoc, CoreRepositories } from '@/lib/data/repositories'
import { eurosToCents } from '@/lib/data/repositories/money'
import { getRepositories } from '@/lib/data/runtime'
import { eventBus } from '@/lib/notifications/event-bus'
import { upsertSnapshot } from '@/lib/stats/aggregation'

const newAuctionPath = '/admin/auctions/new'

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function readOptionalText(formData: FormData, key: string): string | null {
  const value = readText(formData, key)
  return value === '' ? null : value
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?viga=${encodeURIComponent(message)}`)
}

/** Appends a notice param to a path that may already carry a query string. */
function noticePath(path: string, key: 'teade' | 'viga', message: string): string {
  const joiner = path.includes('?') ? '&' : '?'
  return `${path}${joiner}${key}=${encodeURIComponent(message)}`
}

function redirectNotice(path: string, key: 'teade' | 'viga', message: string): never {
  redirect(noticePath(path, key, message))
}

/**
 * Client-chosen return path (monitor, queue views). Only admin-relative
 * paths are honored so the field can never become an open redirect.
 */
function feedbackPathFrom(formData: FormData, fallback: string): string {
  const requested = readOptionalText(formData, 'redirectTo')
  return requested?.startsWith('/admin/') ? requested : fallback
}

function auctionDetailPath(auctionId: string): string {
  return `/admin/auctions/${auctionId}`
}

/**
 * Accepts both payload shapes: the wizard's JSON `payload` field and the
 * legacy flat form keys. Numbers arrive as strings from FormData; arrays
 * arrive as newline/comma separated text.
 */
function formToAuctionInput(formData: FormData): Record<string, unknown> {
  const payloadJson = readText(formData, 'payload')
  if (payloadJson) {
    try {
      const parsed = JSON.parse(payloadJson) as unknown
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      redirectWithError(newAuctionPath, 'Vigane vormi andmete JSON.')
    }
  }

  const text = (key: string): string | undefined => {
    const value = readText(formData, key)
    return value === '' ? undefined : value
  }
  const num = (key: string): number | undefined => {
    const rawValue = text(key)
    if (rawValue === undefined) return undefined
    const parsed = Number(rawValue.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  const bool = (key: string): boolean | undefined => {
    if (formData.get(key) === null) return undefined
    const value = readText(formData, key)
    return value === 'true' || value === 'on' || value === '1'
  }
  const lines = (key: string): string[] | undefined => {
    const value = formData.get(key)
    if (typeof value !== 'string' || value.trim() === '') return undefined
    return value
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '')
  }
  const setIf = (key: string, value: unknown): void => {
    if (value !== undefined) input[key] = value
  }

  const input: Record<string, unknown> = {}
  setIf('title', text('title'))
  setIf('slug', text('slug'))
  setIf('objectType', text('objectType'))
  setIf('auctionType', text('type'))
  setIf('isQuickAuction', bool('isQuickAuction'))
  setIf('antiSnipeEnabled', bool('antiSnipeEnabled'))
  setIf('antiSnipeMinutes', num('antiSnipeMinutes'))
  setIf('startsAt', text('startsAt'))
  setIf('endsAt', text('endsAt'))
  setIf('minBidEur', num('minBidEur'))
  setIf('bidStepEur', num('bidStepEur'))
  setIf('reservePriceEur', num('reservePriceEur'))
  setIf('feeOverridePercent', num('feeOverridePercent'))
  setIf('countyId', text('countyId'))
  setIf('parishId', text('parishId'))
  setIf('address', text('address'))
  setIf('areaHa', num('areaHa'))
  setIf('volumeM3', num('volumeM3'))
  setIf('cadastres', lines('cadastres'))
  setIf('registryNumbers', lines('registryNumbers'))
  setIf('compartments', lines('compartments'))
  setIf('forestNotifications', lines('forestNotifications'))
  setIf('descriptionPublic', text('descriptionPublic'))
  setIf('descriptionSecondary', text('descriptionSecondary'))
  setIf('specialistId', text('specialistId'))
  return input
}

function parseAuctionInputOrRedirect(raw: Record<string, unknown>, path: string): AuctionInput {
  const parsed = auctionInputSchema.safeParse(raw)
  if (!parsed.success) {
    const summary = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || 'vorm'}: ${issue.message}`)
      .join('; ')
    redirectWithError(path, `Oksjoni andmed ei läbinud valideerimist: ${summary}`)
  }
  return applyQuickAuctionDefaults(parsed.data)
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

function generateAliasEmail(): string {
  return `mt${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}@oksjonid.erametsad.ee`
}

/**
 * Input key -> repository write key, so a partial update never wipes
 * stored values that the payload simply omitted (zod array defaults would).
 */
const writeKeyByInputKey: Record<string, string> = {
  title: 'title',
  slug: 'slug',
  objectType: 'objectType',
  auctionType: 'type',
  type: 'type',
  isQuickAuction: 'isQuickAuction',
  startsAt: 'startsAt',
  endsAt: 'endsAt',
  minBidEur: 'minBidCents',
  bidStepEur: 'bidStepCents',
  reservePriceEur: 'reservePriceCents',
  feeOverridePercent: 'feeOverridePercent',
  countyId: 'countyId',
  parishId: 'parishId',
  address: 'address',
  coordinates: 'coordinates',
  cadastres: 'cadastres',
  registryNumbers: 'registryNumbers',
  species: 'species',
  loggingTypes: 'loggingTypes',
  compartments: 'compartments',
  forestNotifications: 'notifications',
  deadlines: 'deadlines',
  antiSnipeEnabled: 'deadlines',
  antiSnipeMinutes: 'deadlines',
  propertyCount: 'deadlines',
  areaHa: 'deadlines',
  volumeM3: 'deadlines',
  descriptionPublic: 'descriptionPublic',
  descriptionInternal: 'descriptionInternal',
  descriptionSecondary: 'descriptionSecondary',
  aliasEmail: 'aliasEmail',
  specialistId: 'specialistId',
  media: 'media',
  files: 'files',
  packageHeader: 'packageHeader',
  packageRows: 'packageRows',
}

function restrictToPresentKeys(
  writeData: AuctionWriteData,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const writeKeys = new Set<string>(['title', 'objectType', 'type'])
  for (const [inputKey, writeKey] of Object.entries(writeKeyByInputKey)) {
    if (raw[inputKey] !== undefined) writeKeys.add(writeKey)
  }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(writeData)) {
    if (writeKeys.has(key)) out[key] = value
  }
  return out
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
  const { session, repositories } = await requireAdminRepositories()

  const raw = formToAuctionInput(formData)
  const input = parseAuctionInputOrRedirect(raw, newAuctionPath)
  const writeData = toAuctionWriteData(input)

  // Specialist lots are always their own; assigning another specialist is a
  // governance write (deny-listed for the specialist role).
  let specialistId = typeof writeData.specialistId === 'string' ? writeData.specialistId : undefined
  if (session.role === 'specialist') {
    if (specialistId && specialistId !== session.userId) {
      assertPermissionOrRedirect(session.role, 'auctions:reassign-specialist', newAuctionPath)
    }
    specialistId = session.userId
  }

  if (writeData.feeOverridePercent !== undefined) {
    assertPermissionOrRedirect(session.role, 'auctions:fee-override', newAuctionPath)
  }

  const slug = await uniqueSlug(repositories, writeData.slug ?? slugifyTitle(input.title))
  const aliasEmail = input.aliasEmail ?? generateAliasEmail()

  let failure: string | null = null
  let created: AuctionDoc | null = null
  try {
    created = await repositories.create({
      collection: 'auctions',
      data: {
        ...writeData,
        slug,
        status: 'draft',
        ...(specialistId ? { specialistId } : {}),
        aliasEmail,
      },
    })
    // Secret values (reserve) are never audited; the create entry records
    // that the lot exists and its non-secret shape (design D5/D7).
    await audit(repositories, {
      actorId: session.userId,
      action: 'auction.create',
      entityType: 'auction',
      entityId: created.id,
      after: {
        title: created.title,
        objectType: created.objectType,
        type: created.type,
        isQuickAuction: created.isQuickAuction,
        ...(writeData.reservePriceCents !== undefined ? { reservePriceSet: true } : {}),
        ...(writeData.feeOverridePercent !== undefined
          ? { feeOverridePercent: writeData.feeOverridePercent }
          : {}),
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure || !created) {
    redirectWithError(newAuctionPath, `Oksjoni loomine ebaõnnestus: ${failure ?? 'tundmatu viga'}`)
  }

  revalidatePath('/admin/auctions')
  redirect(auctionDetailPath(created.id))
}

export async function updateAuctionAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  const detailPath = auctionDetailPath(id)
  const editPath = `${detailPath}/edit`
  if (!id) redirectWithError('/admin/auctions', 'Muudatuseks puudub oksjoni identifikaator.')

  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  assertScopeOrRedirect(session.role, session.userId, auction, editPath)
  assertPermissionOrRedirect(session.role, 'auctions:write', editPath)

  const raw = formToAuctionInput(formData)
  const input = parseAuctionInputOrRedirect(raw, editPath)
  const writeData = toAuctionWriteData(input)

  // An active (or scheduled) lot locks its mechanics: only content fields
  // may change; force requires manual end + re-list (docs 03 interactions).
  const mechanicsLocked = auction.status === 'active' || auction.status === 'scheduled'
  if (mechanicsLocked) {
    // zod defaults must not count as submitted values: the quick-auction
    // flag conflicts only when the payload actually carries it.
    const submittedQuick = typeof raw.isQuickAuction === 'boolean' ? raw.isQuickAuction : null
    const mechanicsConflict =
      (input.startsAt !== undefined && input.startsAt !== auction.startsAt) ||
      (input.endsAt !== undefined && input.endsAt !== auction.endsAt) ||
      (input.minBidEur !== undefined && writeData.minBidCents !== auction.minBidCents) ||
      (input.bidStepEur !== undefined && writeData.bidStepCents !== (auction.bidStepCents ?? null)) ||
      (input.auctionType !== auction.type) ||
      (input.objectType !== auction.objectType) ||
      (submittedQuick !== null && submittedQuick !== auction.isQuickAuction)
    if (mechanicsConflict) {
      redirectWithError(editPath, 'Aktiivse oksjoni mehaanikat muuta ei saa.')
    }
  }

  // Specialist reassignment is deny-listed for specialists and audited for
  // admin+; specialists always keep their own lots.
  const requestedSpecialist =
    input.specialistId !== undefined && input.specialistId !== '' ? input.specialistId : undefined
  if (session.role === 'specialist') {
    if (requestedSpecialist && requestedSpecialist !== session.userId) {
      assertPermissionOrRedirect(session.role, 'auctions:reassign-specialist', editPath)
    }
    writeData.specialistId = session.userId
  } else if (requestedSpecialist && requestedSpecialist !== auction.specialistId) {
    assertPermissionOrRedirect(session.role, 'auctions:reassign-specialist', editPath)
  }

  const reserveChanged = input.reservePriceEur !== undefined
  const feeChanged =
    input.feeOverridePercent !== undefined && input.feeOverridePercent !== auction.feeOverridePercent
  if (feeChanged) {
    assertPermissionOrRedirect(session.role, 'auctions:fee-override', editPath)
  }

  // Partial semantics: keys absent from the raw payload never overwrite the
  // stored lot (zod array defaults would otherwise wipe stored values).
  const updateData = restrictToPresentKeys(writeData, raw)

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'auctions',
      id,
      data: updateData,
    })
    await audit(repositories, {
      actorId: session.userId,
      action: 'auction.update',
      entityType: 'auction',
      entityId: id,
      after: {
        // Masked secret fields per D5/D7: the fact of a change is logged,
        // the value never travels into the audit entry.
        ...(reserveChanged ? { reservePriceChanged: true } : {}),
        ...(feeChanged ? { feeOverridePercent: input.feeOverridePercent } : {}),
        ...(requestedSpecialist && requestedSpecialist !== auction.specialistId
          ? { specialistId: requestedSpecialist }
          : {}),
        ...(mechanicsLocked ? { mechanicsLocked: true } : {}),
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

const MIN_REASON_LENGTH = 5

const reasonHint = `Kirjuta põhjus (vähemalt ${String(MIN_REASON_LENGTH)} tähemärki).`

/** Permission denied becomes an explicit Estonian redirect error, never a silent no-op. */
function assertPermissionOrRedirect(
  role: StaffRole,
  permission: Parameters<typeof assertCan>[1],
  path: string,
): void {
  try {
    assertCan(role, permission)
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      redirectWithError(path, error.message)
    }
    throw error
  }
}

function assertScopeOrRedirect(
  role: StaffRole,
  userId: string,
  auction: { specialistId?: string | null; sellerId?: string | null },
  path: string,
): void {
  const scope = auctionScope(role, userId)
  if (!auctionInScope(scope, auction)) {
    redirectWithError(path, 'Oksjon ei ole teie tööulatuses.')
  }
}

/**
 * Draft clone shared by duplicate (editor copy) and re-list. Lifecycle
 * fields (status, times, winner, final price, timestamps) reset; content
 * and mechanics carry over so the wizard opens prefilled.
 */
async function cloneAuctionDraft(
  repositories: CoreRepositories,
  auction: AuctionDoc,
): Promise<AuctionDoc> {
  return repositories.create({
    collection: 'auctions',
    data: {
      title: auction.title,
      slug: `${auction.slug}-${Date.now().toString(36)}`,
      status: 'draft',
      objectType: auction.objectType,
      type: auction.type,
      isQuickAuction: auction.isQuickAuction,
      countyId: auction.countyId,
      parishId: auction.parishId,
      address: auction.address,
      coordinates: auction.coordinates,
      cadastres: auction.cadastres,
      registryNumbers: auction.registryNumbers,
      species: auction.species,
      loggingTypes: auction.loggingTypes,
      compartments: auction.compartments,
      notifications: auction.notifications,
      deadlines: auction.deadlines,
      minBidCents: auction.minBidCents,
      bidStepCents: auction.bidStepCents,
      feeOverridePercent: auction.feeOverridePercent,
      descriptionPublic: auction.descriptionPublic,
      descriptionInternal: auction.descriptionInternal,
      descriptionSecondary: auction.descriptionSecondary,
      aliasEmail: auction.aliasEmail,
      media: auction.media,
      files: auction.files,
      packageHeader: auction.packageHeader,
      packageRows: auction.packageRows,
      packageColumns: auction.packageColumns,
      specialistId: auction.specialistId,
      sellerId: auction.sellerId,
    },
  })
}

/**
 * Manual end for an active auction (docs/design/admin/02): typed reason of
 * at least 5 characters plus an outcome — declare the leading bid the
 * winner, or mark the lot unsold. Statuses walk the immutable chain one
 * step at a time: active → ended → appraised | unsold.
 */
export async function endAuctionManuallyAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError('/admin/auctions', 'Lõpetamiseks puudub oksjoni identifikaator.')
  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  const detailPath = auctionDetailPath(id)
  // The monitor modal returns to its own screen; the list stays on the list.
  const feedbackPath = feedbackPathFrom(formData, detailPath)

  assertPermissionOrRedirect(session.role, 'auctions:end-manual', detailPath)
  assertScopeOrRedirect(session.role, session.userId, auction, detailPath)
  if (auction.status !== 'active') {
    redirectWithError(feedbackPath, 'Käsitsi saab lõpetada ainult aktiivset oksjonit.')
  }

  const reason = readText(formData, 'reason')
  const outcome = readText(formData, 'outcome')
  if (reason.length < MIN_REASON_LENGTH) {
    redirectWithError(feedbackPath, reasonHint)
  }
  if (outcome !== 'winner' && outcome !== 'unsold') {
    redirectWithError(feedbackPath, 'Vali lõpetamise tulemus: võitja kuulutamine või müümata märkimine.')
  }

  const leading = await repositories.find({
    collection: 'bids',
    where: {
      and: [
        { auction: { equals: id } },
        { status: { equals: 'leading' } },
      ],
    },
    sort: '-amountCents',
    limit: 1,
  })
  const leadingBid = leading.docs[0]

  if (outcome === 'winner' && !leadingBid) {
    redirectWithError(feedbackPath, 'Juhtivat pakkumust ei ole; märgi oksjon müümata.')
  }

  try {
    await repositories.update({
      collection: 'auctions',
      id,
      data: { status: 'ended' },
    })

    let after: Record<string, unknown>
    if (outcome === 'winner' && leadingBid) {
      await repositories.update({
        collection: 'bids',
        id: leadingBid.id,
        data: { status: 'won' },
      })
      await repositories.update({
        collection: 'auctions',
        id,
        data: {
          status: 'appraised',
          winningBid: leadingBid.id,
          finalPriceCents: leadingBid.amountCents,
        },
      })
      after = {
        outcome: 'winner',
        reason,
        bidId: leadingBid.id,
        finalPriceCents: leadingBid.amountCents,
        status: 'appraised',
      }
    } else {
      await repositories.update({
        collection: 'auctions',
        id,
        data: { status: 'unsold' },
      })
      after = { outcome: 'unsold', reason, status: 'unsold' }
    }

    await audit(repositories, {
      actorId: session.userId,
      action: 'auction.end_manual',
      entityType: 'auction',
      entityId: id,
      after,
    })
  } catch (error) {
    redirectWithError(
      feedbackPath,
      `Käsitsi lõpetamine ebaõnnestus: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  revalidatePath('/admin/auctions')
  revalidatePath(detailPath)
  revalidatePath(feedbackPath)
  redirect(
    noticePath(
      feedbackPath,
      'teade',
      outcome === 'winner' ? 'Oksjon lõpetatud; juhtiv pakkumus kuulutatud võitjaks.' : 'Oksjon lõpetatud ja märgitud müümata.',
    ),
  )
}

/**
 * Archive with a typed reason. The immutable chain reaches `archived` only
 * from `completed`, so an unsold lot walks unsold → completed → archived.
 */
export async function archiveAuctionAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError('/admin/auctions', 'Arhiiveerimiseks puudub oksjoni identifikaator.')
  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  const detailPath = auctionDetailPath(id)

  assertPermissionOrRedirect(session.role, 'auctions:archive', detailPath)
  assertScopeOrRedirect(session.role, session.userId, auction, detailPath)

  const reason = readText(formData, 'reason')
  if (reason.length < MIN_REASON_LENGTH) {
    redirectWithError(detailPath, reasonHint)
  }

  const from = auction.status
  if (from !== 'unsold' && from !== 'completed') {
    redirectWithError(
      detailPath,
      'Arhiiveerida saab müümata või teostatud oksjonit; lõppenud oksjon vajab esiteks tulemust.',
    )
  }

  try {
    if (from === 'unsold') {
      await repositories.update({
        collection: 'auctions',
        id,
        data: { status: 'completed', completedAt: new Date().toISOString() },
      })
    }
    await repositories.update({
      collection: 'auctions',
      id,
      data: { status: 'archived', archivedAt: new Date().toISOString() },
    })
    await audit(repositories, {
      actorId: session.userId,
      action: 'auction.archive',
      entityType: 'auction',
      entityId: id,
      after: { reason, from, status: 'archived' },
    })
  } catch (error) {
    redirectWithError(
      detailPath,
      `Arhiiveerimine ebaõnnestus: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  revalidatePath('/admin/auctions')
  revalidatePath(detailPath)
  redirect(`${detailPath}?teade=${encodeURIComponent('Oksjon arhiivitud.')}`)
}

/**
 * Re-list (docs 02 "Avalda uuesti"): clone an ended or unsold lot into a
 * fresh draft with cleared schedule; the original keeps its finalPrice.
 */
export async function relistAuctionAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError('/admin/auctions', 'Uuesti avaldamiseks puudub oksjoni identifikaator.')
  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  const detailPath = auctionDetailPath(id)

  assertPermissionOrRedirect(session.role, 'auctions:write', detailPath)
  assertScopeOrRedirect(session.role, session.userId, auction, detailPath)
  if (auction.status !== 'ended' && auction.status !== 'unsold') {
    redirectWithError(detailPath, 'Uuesti saab avaldada lõppenud või müümata märgitud oksjonit.')
  }

  let clone: AuctionDoc | null = null
  let failure: string | null = null
  try {
    clone = await cloneAuctionDraft(repositories, auction)
    await audit(repositories, {
      actorId: session.userId,
      action: 'auction.relist',
      entityType: 'auction',
      entityId: id,
      after: { originalStatus: auction.status, newAuctionId: clone.id },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure || !clone) {
    redirectWithError(detailPath, `Uuesti avaldamine ebaõnnestus: ${failure ?? 'tundmatu viga'}`)
  }

  revalidatePath('/admin/auctions')
  redirect(`/admin/auctions/${clone.id}/edit`)
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
  assertScopeOrRedirect(session.role, session.userId, auction, detailPath)
  assertPermissionOrRedirect(session.role, 'auctions:write', detailPath)

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

  // Publish gates (docs 03 validation summary): blocking failures stop the
  // publish, warnings travel in the audit entry without blocking.
  const gates = collectPublishGateFailures({
    objectType: auction.objectType,
    type: auction.type,
    isQuickAuction: auction.isQuickAuction,
    startsAt: auction.startsAt,
    endsAt: auction.endsAt,
    minBidCents: auction.minBidCents,
    reservePriceCents: auction.reservePriceCents,
    cadastres: auction.cadastres,
    countyId: auction.countyId,
    parishId: auction.parishId,
    packageRows: auction.packageRows,
    media: auction.media,
  })
  if (gates.blocking.length > 0) {
    const summary = gates.blocking
      .slice(0, 5)
      .map((gate) => `${gate.step} → ${gate.message}`)
      .join(' | ')
    redirectWithError(detailPath, `Avaldamine on blokeeritud: ${summary}`)
  }

  const nowIso = new Date().toISOString()
  const target = Date.parse(auction.startsAt) > Date.now() ? 'scheduled' : 'active'
  const auditNote = readOptionalText(formData, 'auditNote')

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
      action: 'auction.publish',
      entityType: 'auction',
      entityId: id,
      after: {
        status: target,
        ...(auditNote ? { auditNote } : {}),
        ...(gates.warnings.length > 0 ? { warnings: gates.warnings } : {}),
      },
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

/**
 * Editor duplicate (docs 02/03): a draft copy with cleared schedule; the
 * original is untouched. Lifecycle fields reset through the shared clone.
 */
export async function duplicateAuctionAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError('/admin/auctions', 'Dubleerimiseks puudub oksjoni identifikaator.')
  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  const detailPath = auctionDetailPath(id)

  assertPermissionOrRedirect(session.role, 'auctions:write', detailPath)
  assertScopeOrRedirect(session.role, session.userId, auction, detailPath)

  let clone: AuctionDoc | null = null
  let failure: string | null = null
  try {
    clone = await cloneAuctionDraft(repositories, auction)
    await audit(repositories, {
      actorId: session.userId,
      action: 'auction.create',
      entityType: 'auction',
      entityId: clone.id,
      after: { copiedFrom: id, title: clone.title },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure || !clone) {
    redirectWithError(detailPath, `Dubleerimine ebaõnnestus: ${failure ?? 'tundmatu viga'}`)
  }

  revalidatePath('/admin/auctions')
  redirect(`${auctionDetailPath(clone.id)}/edit?teade=${encodeURIComponent('Koopia loodud mustandina.')}`)
}

/**
 * Alias e-mail regenerate (docs 03 step 5): a fresh inbound address for
 * the lot; the old address stops receiving after the switch. Audited.
 */
export async function regenerateAliasEmailAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError('/admin/auctions', 'Aadressi vahetuseks puudub oksjoni identifikaator.')
  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  const detailPath = auctionDetailPath(id)

  assertPermissionOrRedirect(session.role, 'auctions:write', detailPath)
  assertScopeOrRedirect(session.role, session.userId, auction, detailPath)

  const previousAlias = auction.aliasEmail
  const aliasEmail = generateAliasEmail()

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'auctions',
      id,
      data: { aliasEmail },
    })
    await audit(repositories, {
      actorId: session.userId,
      action: 'auction.alias_regen',
      entityType: 'auction',
      entityId: id,
      after: { previousAlias, aliasEmail },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(detailPath, `Aadressi vahetus ebaõnnestus: ${failure}`)
  }

  revalidatePath(detailPath)
  redirect(`${detailPath}?teade=${encodeURIComponent(`Uus alias-aadress: ${aliasEmail}`)}`)
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
    // Bind the contract to the winning bidder, not the admin: the winner
    // completes the signing session on the portal side.
    const winningBidId = typeof auction.winningBid === 'string' ? auction.winningBid : null
    const winningBid = winningBidId
      ? await repositories.findByID({ collection: 'bids', id: winningBidId })
      : null
    const winnerUserId = typeof winningBid?.userId === 'string' ? winningBid.userId : null
    if (!winnerUserId) {
      throw new Error('Oksjoni võitja puudub')
    }
    const contract = await prepareContract(auctionId, 'auction', winnerUserId)
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
  /** Kehtetu pakkumise põhjus (identity/decrypt failure); null kehtivatel. */
  invalidReason: string | null
  /** Koht kehtivate pakkumiste järjestuses; kehtetul null. */
  rank: number | null
  /** Viik — varasem esitus võidab (top two amounts equal). */
  tie: boolean
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
    const bids: RevealedBidView[] = result.bids.map((bid, index) => ({
      id: bid.id,
      amount: bid.amount,
      createdAt: bid.createdAt,
      valid: bid.valid,
      invalidReason: bid.valid ? null : 'Krüptimine ebaõnnestus',
      rank: bid.valid ? index + 1 : null,
      tie: false,
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
  const { session, repositories } = await requireAdminRepositories()

  const auctionId = readText(formData, 'auctionId')
  if (!auctionId) {
    redirectWithError('/admin/auctions', 'Tühistamiseks puudub oksjoni identifikaator.')
  }
  const detailPath = auctionDetailPath(auctionId)
  const ceremonyPath = `${detailPath}/ceremony`

  // docs 05: the void path is superadmin-only with a typed reason.
  if (session.role !== 'superadmin') {
    redirectWithError(ceremonyPath, 'Avamise tühistada saab ainult superadmin.')
  }
  const reason = readText(formData, 'reason')
  if (reason.length < MIN_REASON_LENGTH) {
    redirectWithError(ceremonyPath, `Tühistamise põhjus on kohustuslik (vähemalt ${String(MIN_REASON_LENGTH)} tähemärki).`)
  }

  const auction = await repositories.findByID({ collection: 'auctions', id: auctionId })
  if (!auction) redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  if (auction.status !== 'ended') {
    redirectWithError(
      ceremonyPath,
      'Tühistada saab enne võitja kinnitamist; pärast kinnitamist tühistab lepingu 08 moodulis.',
    )
  }

  let failure: string | null = null
  try {
    // Every sealed bid on the lot is voided; amounts were never revealed.
    const sealedBids = await getSealedBidsForAuction(auctionId)
    for (const bid of sealedBids) {
      const status = typeof bid.status === 'string' ? bid.status : ''
      if (status === 'rejected') continue
      const bidId = typeof bid.id === 'string' ? bid.id : ''
      if (bidId === '') continue
      await repositories.update({
        collection: 'bids',
        id: bidId,
        data: { status: 'rejected' },
      })
    }

    await repositories.update({
      collection: 'auctions',
      id: auctionId,
      data: { status: 'unsold' },
    })

    const bidderIds = [
      ...new Set(
        sealedBids
          .map((bid) => (typeof bid.userId === 'string' ? bid.userId : ''))
          .filter((userId) => userId !== ''),
      ),
    ]
    for (const bidderId of bidderIds) {
      eventBus.emit({
        type: 'auction.ended',
        userId: bidderId,
        payload: {
          auctionId,
          auctionTitle: auction.title,
          type: 'sealed',
          hasWinner: false,
          voided: true,
        },
      })
    }

    await audit(repositories, {
      actorId: session.userId,
      action: 'sealed.void',
      entityType: 'auction',
      entityId: auctionId,
      after: { reason, status: 'unsold', voidedBidCount: sealedBids.length },
    })

    await ceremonyCache.delete(ceremonyRecordKey(auctionId))
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(ceremonyPath, `Avamise tühistamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(detailPath)
  revalidatePath(ceremonyPath)
  redirect(`${detailPath}?teade=${encodeURIComponent('Oksjon tühistatud ja kuulutatud müümata.')}`)
}

// ── Sealed-opening ceremony (task 3.3) ──────────────────────────────────────
//
// Ceremony state lives in the SEALED_CEREMONY cache for the 30-minute
// signature windows and in the append-only audit chain for everything
// durable (design D4: auction row + audit entries, no new table). The
// `sealed.reveal` audit entry is the one-shot marker: a repeat reveal
// replays the same ranked record instead of decrypting twice.

const CEREMONY_SIGNATURE_TTL_SECONDS = 30 * 60
const CEREMONY_REVEAL_GRACE_MS = 60_000
const OPENING_KEYWORD = 'AVAN'
const CONFIRM_KEYWORD = 'KINNITAN'
const INVALID_BID_REASON = 'Krüptimine ebaõnnestus — pakkumine kehtetu'

const ceremonyCache = createCache('SEALED_CEREMONY')

function ceremonyRecordKey(auctionId: string): string {
  return `ceremony:${auctionId}`
}

interface CeremonySignatureRecord {
  userId: string
  sessionId: string
  signedAt: string
}

interface CeremonyRecord {
  auctionId: string
  opener: CeremonySignatureRecord
  approver?: CeremonySignatureRecord
}

function signatureFresh(signature: CeremonySignatureRecord): boolean {
  return Date.now() - Date.parse(signature.signedAt) <= CEREMONY_SIGNATURE_TTL_SECONDS * 1000
}

async function loadCeremonyRecord(auctionId: string): Promise<CeremonyRecord | null> {
  const raw = await ceremonyCache.get(ceremonyRecordKey(auctionId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CeremonyRecord
    return parsed.auctionId === auctionId ? parsed : null
  } catch {
    return null
  }
}

async function saveCeremonyRecord(record: CeremonyRecord): Promise<void> {
  await ceremonyCache.set(
    ceremonyRecordKey(record.auctionId),
    JSON.stringify(record),
    CEREMONY_SIGNATURE_TTL_SECONDS,
  )
}

/** Session identity of the signed-in admin; distinct sessions are enforced on this pair. */
async function currentSigner(): Promise<{ userId: string; sessionId: string } | null> {
  const token = await adminAccessToken()
  if (!token) return null
  const payload = verifyAdminAccessToken(token)
  if (!payload) return null
  return { userId: payload.userId, sessionId: payload.sessionId ?? `token:${payload.userId}` }
}

function ceremonyOperateOrError(role: StaffRole): string | null {
  try {
    assertCan(role, 'sealed:operate')
    return null
  } catch (error) {
    if (error instanceof PermissionDeniedError) return error.message
    throw error
  }
}

async function findCeremonyAuditEntry(
  repositories: CoreRepositories,
  action: string,
  auctionId: string,
): Promise<{ id: string; createdAt: string } | null> {
  const entries = await repositories.find({
    collection: 'audit-entry',
    where: {
      and: [{ action: { equals: action } }, { entityId: { equals: auctionId } }],
    },
    sort: '-createdAt',
    limit: 1,
  })
  return entries.docs[0] ?? null
}

/** Ranked reveal views: valid bids amount-desc with earliest-wins ties, invalid bids greyed. */
function rankedViews(decrypted: DecryptedBid[]): RevealedBidView[] {
  const valid = decrypted
    .filter((bid) => bid.valid)
    .sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount
      return Date.parse(a.createdAt) - Date.parse(b.createdAt)
    })
  const views: RevealedBidView[] = valid.map((bid, index) => ({
    id: bid.id,
    amount: bid.amount,
    createdAt: bid.createdAt,
    valid: true,
    invalidReason: null,
    rank: index + 1,
    tie: false,
  }))
  const top = views[0]
  const second = views[1]
  if (second !== undefined && top?.amount === second.amount) {
    top.tie = true
  }
  for (const bid of decrypted.filter((entry) => !entry.valid)) {
    views.push({
      id: bid.id,
      amount: bid.amount,
      createdAt: bid.createdAt,
      valid: false,
      invalidReason: INVALID_BID_REASON,
      rank: null,
      tie: false,
    })
  }
  return views
}

export interface SealedCeremonyChecklist {
  endingWorker: { done: boolean; key: string | null; endedAt: string | null }
  pendingAlapakkumised: number
  template: { active: boolean; name: string | null; version: string | null; changedWithin24h: boolean }
}

export interface SealedCeremonyContext {
  auctionId: string
  status: string
  endedAt: string | null
  revealAllowedAt: string | null
  checklist: SealedCeremonyChecklist
  opener: { userId: string; signedAt: string } | null
  approver: { userId: string; signedAt: string } | null
  signaturesExpired: boolean
  revealed: boolean
  revealedAt: string | null
  bids: RevealedBidView[]
  /** Server-side reserve comparison result; the reserve value itself never leaves the server (D5). */
  topMeetsReserve: boolean | null
  winnerConfirmed: boolean
  voided: boolean
  error: string | null
}

export interface SealedCeremonyActionState {
  ok: boolean
  phase: 'checklist' | 'awaiting-approval' | 'revealed' | 'confirmed' | 'unsold' | 'house-backup'
  error: string | null
}

async function loadCeremonyChecklist(
  repositories: CoreRepositories,
  auction: AuctionDoc,
): Promise<SealedCeremonyChecklist> {
  const endedEntry = await findCeremonyAuditEntry(repositories, 'auction_ended', auction.id)
  const pending = await repositories.find({
    collection: 'bids',
    where: {
      and: [{ auction: { equals: auction.id } }, { status: { equals: 'pending_approval' } }],
    },
    pagination: false,
    limit: 500,
  })
  const templates = await repositories.find({
    collection: 'contract-templates',
    where: {
      and: [{ type: { equals: 'auction' } }, { active: { equals: true } }],
    },
    sort: '-createdAt',
    limit: 1,
  })
  const template = templates.docs[0]
  const startsAt = typeof auction.startsAt === 'string' ? auction.startsAt : null
  const templateUpdatedAt = typeof template?.updatedAt === 'string' ? template.updatedAt : null
  const changedWithin24h =
    startsAt !== null &&
    templateUpdatedAt !== null &&
    (templateUpdatedAt >= startsAt ||
      Date.parse(startsAt) - Date.parse(templateUpdatedAt) <= 24 * 60 * 60 * 1000)
  return {
    endingWorker: {
      done: endedEntry !== null,
      key: endedEntry?.id ?? null,
      endedAt: typeof auction.endedAt === 'string' ? auction.endedAt : null,
    },
    pendingAlapakkumised: pending.docs.length,
    template: {
      active: template !== undefined,
      name: template?.name ?? null,
      version: template?.version ?? null,
      changedWithin24h,
    },
  }
}

/** Read model for the ceremony screen (checklist, signatures, record view). */
export async function sealedCeremonyStateAction(auctionId: string): Promise<SealedCeremonyContext> {
  const { session, repositories } = await requireAdminRepositories()
  const emptyContext: SealedCeremonyContext = {
    auctionId,
    status: '',
    endedAt: null,
    revealAllowedAt: null,
    checklist: {
      endingWorker: { done: false, key: null, endedAt: null },
      pendingAlapakkumised: 0,
      template: { active: false, name: null, version: null, changedWithin24h: false },
    },
    opener: null,
    approver: null,
    signaturesExpired: false,
    revealed: false,
    revealedAt: null,
    bids: [],
    topMeetsReserve: null,
    winnerConfirmed: false,
    voided: false,
    error: null,
  }
  try {
    assertCan(session.role, 'sealed:read')
  } catch (error) {
    return {
      ...emptyContext,
      error: error instanceof PermissionDeniedError ? error.message : 'Ligipääs keelatud.',
    }
  }

  const auction = await repositories.findByID({ collection: 'auctions', id: auctionId })
  if (!auction) return { ...emptyContext, error: 'Oksjonit ei leitud.' }

  const checklist = await loadCeremonyChecklist(repositories, auction)
  const record = await loadCeremonyRecord(auctionId)
  const revealEntry = await findCeremonyAuditEntry(repositories, 'sealed.reveal', auctionId)
  const winnerEntry = await findCeremonyAuditEntry(repositories, 'sealed.winner_confirm', auctionId)
  const voidEntry = await findCeremonyAuditEntry(repositories, 'sealed.void', auctionId)

  let bids: RevealedBidView[] = []
  let topMeetsReserve: boolean | null = null
  if (revealEntry !== null) {
    const decrypted = decryptSealedBids(await getSealedBidsForAuction(auctionId))
    bids = rankedViews(decrypted)
    const topValid = bids.find((bid) => bid.valid)
    if (topValid && typeof auction.reservePriceCents === 'number') {
      topMeetsReserve = eurosToCents(topValid.amount) >= auction.reservePriceCents
    } else {
      topMeetsReserve = topValid !== undefined
    }
  }

  const signaturesExpired =
    record !== null && ((record.approver !== undefined && !signatureFresh(record.approver)) || !signatureFresh(record.opener))

  return {
    auctionId,
    status: auction.status,
    endedAt: typeof auction.endedAt === 'string' ? auction.endedAt : null,
    revealAllowedAt:
      typeof auction.endedAt === 'string'
        ? new Date(Date.parse(auction.endedAt) + CEREMONY_REVEAL_GRACE_MS).toISOString()
        : null,
    checklist,
    opener: record ? { userId: record.opener.userId, signedAt: record.opener.signedAt } : null,
    approver: record?.approver
      ? { userId: record.approver.userId, signedAt: record.approver.signedAt }
      : null,
    signaturesExpired,
    revealed: revealEntry !== null,
    revealedAt: revealEntry?.createdAt ?? null,
    bids,
    topMeetsReserve,
    winnerConfirmed: winnerEntry !== null,
    voided: voidEntry !== null,
    error: null,
  }
}

/** Opener signature: typed keyword, clean checklist, 30-minute validity. */
export async function signSealedOpenerAction(
  _prev: SealedCeremonyActionState,
  formData: FormData,
): Promise<SealedCeremonyActionState> {
  const { session, repositories } = await requireAdminRepositories()
  const denied = ceremonyOperateOrError(session.role)
  if (denied) return { ok: false, phase: 'checklist', error: denied }

  const auctionId = readText(formData, 'auctionId')
  const keyword = readText(formData, 'keyword')
  const note = readOptionalText(formData, 'note')
  if (keyword !== OPENING_KEYWORD) {
    return { ok: false, phase: 'checklist', error: `Kirjuta kinnitusväljale "${OPENING_KEYWORD}".` }
  }

  const auction = await repositories.findByID({ collection: 'auctions', id: auctionId })
  if (!auction) return { ok: false, phase: 'checklist', error: 'Oksjonit ei leitud.' }
  if (auction.status !== 'ended') {
    return { ok: false, phase: 'checklist', error: 'Avamine on lubatud ainult lõppenud oksjonil.' }
  }

  const checklist = await loadCeremonyChecklist(repositories, auction)
  const blockers: string[] = []
  if (!checklist.endingWorker.done) blockers.push('lõpuaeg ei ole kinnitatud (lõpetustöötlus puudub)')
  if (checklist.pendingAlapakkumised > 0) blockers.push('alapakkumisi on ootel')
  if (!checklist.template.active) blockers.push('aktiivset lepingu malli ei ole')
  if (blockers.length > 0) {
    return { ok: false, phase: 'checklist', error: `Eelkontroll ei läbi: ${blockers.join('; ')}.` }
  }

  const signer = await currentSigner()
  if (!signer) return { ok: false, phase: 'checklist', error: 'Sisselogimise token puudub.' }

  await saveCeremonyRecord({
    auctionId,
    opener: { userId: signer.userId, sessionId: signer.sessionId, signedAt: new Date().toISOString() },
  })
  await audit(repositories, {
    actorId: session.userId,
    action: 'sealed.sign_opener',
    entityType: 'auction',
    entityId: auctionId,
    after: { note: note ?? null },
  })
  return { ok: true, phase: 'awaiting-approval', error: null }
}

/** Approver signature: distinct session and user, typed keyword, 30-minute validity. */
export async function signSealedApproverAction(
  _prev: SealedCeremonyActionState,
  formData: FormData,
): Promise<SealedCeremonyActionState> {
  const { session, repositories } = await requireAdminRepositories()
  const denied = ceremonyOperateOrError(session.role)
  if (denied) return { ok: false, phase: 'checklist', error: denied }

  const auctionId = readText(formData, 'auctionId')
  const keyword = readText(formData, 'keyword')
  if (keyword !== CONFIRM_KEYWORD) {
    return { ok: false, phase: 'checklist', error: `Kirjuta kinnitusväljale "${CONFIRM_KEYWORD}".` }
  }

  const record = await loadCeremonyRecord(auctionId)
  if (!record) {
    return { ok: false, phase: 'checklist', error: 'Avamise sessiooni ei leitud või see on aegunud.' }
  }
  if (!signatureFresh(record.opener)) {
    return { ok: false, phase: 'checklist', error: 'Avaja allkiri on aegunud; alusta avamist uuesti.' }
  }

  const signer = await currentSigner()
  if (!signer) return { ok: false, phase: 'checklist', error: 'Sisselogimise token puudub.' }
  if (signer.userId === record.opener.userId) {
    return { ok: false, phase: 'checklist', error: 'Kinnitaja peab olema teine isik kui avaja.' }
  }
  if (signer.sessionId === record.opener.sessionId) {
    return { ok: false, phase: 'checklist', error: 'Allkirjad peavad tulema erinevatest sessioonidest.' }
  }

  record.approver = { userId: signer.userId, sessionId: signer.sessionId, signedAt: new Date().toISOString() }
  await saveCeremonyRecord(record)
  await audit(repositories, {
    actorId: session.userId,
    action: 'sealed.sign_approver',
    entityType: 'auction',
    entityId: auctionId,
    after: { openerUserId: record.opener.userId },
  })
  return { ok: true, phase: 'awaiting-approval', error: null }
}

/**
 * One-shot simultaneous reveal: both signatures must be valid and at least
 * 60 seconds must have passed since the recorded end time. The reveal
 * writes the `sealed.reveal` audit entry; any repeat call replays the same
 * ranked record (read-only after reveal).
 */
export async function revealSealedBidsAction(
  _prev: SealedCeremonyActionState,
  formData: FormData,
): Promise<SealedCeremonyActionState> {
  const { session, repositories } = await requireAdminRepositories()
  const denied = ceremonyOperateOrError(session.role)
  if (denied) return { ok: false, phase: 'checklist', error: denied }

  const auctionId = readText(formData, 'auctionId')
  const auction = await repositories.findByID({ collection: 'auctions', id: auctionId })
  if (!auction) return { ok: false, phase: 'checklist', error: 'Oksjonit ei leitud.' }
  if (auction.status !== 'ended') {
    return { ok: false, phase: 'checklist', error: 'Paljastada saab ainult lõppenud oksjonit.' }
  }

  const signer = await currentSigner()
  if (!signer) return { ok: false, phase: 'checklist', error: 'Sisselogimise token puudub.' }

  const record = await loadCeremonyRecord(auctionId)
  if (
    record &&
    record.opener.userId !== signer.userId &&
    record.approver?.userId !== signer.userId
  ) {
    return { ok: false, phase: 'checklist', error: 'Paljastada saab ainult avamise osapool.' }
  }

  const existing = await findCeremonyAuditEntry(repositories, 'sealed.reveal', auctionId)
  if (existing !== null) {
    return { ok: true, phase: 'revealed', error: null }
  }

  if (record?.approver === undefined) {
    return { ok: false, phase: 'awaiting-approval', error: 'Avamine vajab mõlemat allkirja.' }
  }
  if (!signatureFresh(record.opener) || !signatureFresh(record.approver)) {
    return {
      ok: false,
      phase: 'awaiting-approval',
      error: 'Allkirjad on aegunud (30 minutit) — alusta avamist uuesti.',
    }
  }

  const endedAt = typeof auction.endedAt === 'string' ? auction.endedAt : null
  if (endedAt === null || Date.now() < Date.parse(endedAt) + CEREMONY_REVEAL_GRACE_MS) {
    const unlockAt =
      endedAt !== null
        ? new Date(Date.parse(endedAt) + CEREMONY_REVEAL_GRACE_MS).toLocaleString('et-EE')
        : 'tundmatu aeg'
    return { ok: false, phase: 'awaiting-approval', error: `Paljastus avaneb 60 sekundit pärast lõppaega (${unlockAt}).` }
  }

  const decrypted = decryptSealedBids(await getSealedBidsForAuction(auctionId))
  const views = rankedViews(decrypted)
  const validCount = views.filter((bid) => bid.valid).length
  const top = views.find((bid) => bid.valid)

  await audit(repositories, {
    actorId: session.userId,
    action: 'sealed.reveal',
    entityType: 'auction',
    entityId: auctionId,
    after: {
      // Amounts stay unmasked in ceremony entries (internal record, docs 14).
      totalBids: decrypted.length,
      validCount,
      invalidCount: decrypted.length - validCount,
      topAmount: top?.amount ?? null,
      topTie: top?.tie ?? false,
      openerUserId: record.opener.userId,
      approverUserId: record.approver.userId,
    },
  })

  return { ok: true, phase: 'revealed', error: null }
}

/**
 * Winner confirmation against the reserve with step-up re-auth of the
 * opener. Paths: sold (top ≥ reserve), unsold with a typed reason, and the
 * superadmin-only kiiroksjon house-backup decision.
 */
export async function confirmSealedCeremonyWinnerAction(
  _prev: SealedCeremonyActionState,
  formData: FormData,
): Promise<SealedCeremonyActionState> {
  const { session, repositories } = await requireAdminRepositories()
  const denied = ceremonyOperateOrError(session.role)
  if (denied) return { ok: false, phase: 'checklist', error: denied }

  const auctionId = readText(formData, 'auctionId')
  const bidId = readText(formData, 'bidId')
  const decision = readText(formData, 'decision')
  const keyword = readText(formData, 'keyword')
  const password = readText(formData, 'password')
  const reason = readText(formData, 'reason')

  if (keyword !== CONFIRM_KEYWORD) {
    return { ok: false, phase: 'revealed', error: `Kirjuta kinnitusväljale "${CONFIRM_KEYWORD}".` }
  }
  if (decision !== 'sold' && decision !== 'unsold' && decision !== 'house-backup') {
    return { ok: false, phase: 'revealed', error: 'Vali tulemus: müük, müümata või varupakkumine.' }
  }
  if (decision === 'unsold' && reason.length < MIN_REASON_LENGTH) {
    return {
      ok: false,
      phase: 'revealed',
      error: `Müümata märkimine vajab põhjust (vähemalt ${String(MIN_REASON_LENGTH)} tähemärki).`,
    }
  }

  const auction = await repositories.findByID({ collection: 'auctions', id: auctionId })
  if (!auction) return { ok: false, phase: 'revealed', error: 'Oksjonit ei leitud.' }
  if (auction.status !== 'ended') {
    return { ok: false, phase: 'revealed', error: 'Võitjat saab kinnitada ainult lõppenud oksjonil.' }
  }

  const record = await loadCeremonyRecord(auctionId)
  if (!record) {
    return { ok: false, phase: 'revealed', error: 'Avamise sessioon puudub või on aegunud.' }
  }

  // Step-up re-auth: only the opener confirms, with their password. eID-only
  // accounts (no password hash) confirm with the fresh session token instead.
  const signer = await currentSigner()
  if (!signer) return { ok: false, phase: 'revealed', error: 'Sisselogimise token puudub.' }
  if (signer.userId !== record.opener.userId) {
    return { ok: false, phase: 'revealed', error: 'Võitja kinnitab avaja pärast uuesti autentimist.' }
  }
  let reauthMethod: 'password' | 'token' = 'password'
  if (password !== '') {
    const openerUser = await repositories.findByID({ collection: 'users', id: record.opener.userId })
    const passwordHash = openerUser?.passwordHash
    if (typeof passwordHash !== 'string' || passwordHash === '') {
      reauthMethod = 'token'
    } else if (!(await verifyPassword(password, passwordHash))) {
      return { ok: false, phase: 'revealed', error: 'Salasõna ei ole õige.' }
    }
  } else {
    reauthMethod = 'token'
  }

  const revealEntry = await findCeremonyAuditEntry(repositories, 'sealed.reveal', auctionId)
  if (revealEntry === null) {
    return { ok: false, phase: 'revealed', error: 'Enne kinnitamist paljasta pakkumised.' }
  }

  const decrypted = decryptSealedBids(await getSealedBidsForAuction(auctionId))
  const views = rankedViews(decrypted)
  const top = views.find((bid) => bid.valid)

  if (decision === 'house-backup') {
    const isKiiroksjon = auction.isQuickAuction || auction.objectType === 'kiire'
    if (session.role !== 'superadmin') {
      return { ok: false, phase: 'revealed', error: 'Varupakkumise töövoo käivitab ainult superadmin.' }
    }
    if (!isKiiroksjon) {
      return { ok: false, phase: 'revealed', error: 'Varupakkumine kehtib ainult kiiroksjonile.' }
    }
    await audit(repositories, {
      actorId: session.userId,
      action: 'sealed.house_backup',
      entityType: 'auction',
      entityId: auctionId,
      after: { reason: reason || null, topAmount: top?.amount ?? null },
    })
    return { ok: true, phase: 'house-backup', error: null }
  }

  if (decision === 'unsold') {
    await repositories.update({
      collection: 'auctions',
      id: auctionId,
      data: { status: 'unsold' },
    })
    await audit(repositories, {
      actorId: session.userId,
      action: 'sealed.mark_unsold',
      entityType: 'auction',
      entityId: auctionId,
      after: { reason, topAmount: top?.amount ?? null },
    })
    return { ok: true, phase: 'unsold', error: null }
  }

  // Sold: only the top valid bid can win, and only at or above the reserve.
  if (!top) {
    return { ok: false, phase: 'revealed', error: 'Kehtivaid pakkumisi ei ole; märgi oksjon müümata.' }
  }
  if (bidId !== top.id) {
    return { ok: false, phase: 'revealed', error: 'Võitjaks saab kinnitada ainult kõrgeima kehtiva pakkumise.' }
  }
  if (typeof auction.reservePriceCents === 'number' && eurosToCents(top.amount) < auction.reservePriceCents) {
    return {
      ok: false,
      phase: 'revealed',
      error: 'Kõrgeim pakkumis jääb piirhinnale alla; kasuta müümata või varupakkumise teed.',
    }
  }

  const target = decrypted.find((bid) => bid.id === top.id)
  if (!target) {
    return { ok: false, phase: 'revealed', error: 'Pakkumust ei leitud.' }
  }

  const failure: string | null = await (async (): Promise<string | null> => {
    try {
      await repositories.update({
        collection: 'bids',
        id: target.id,
        data: { status: 'won' },
      })
      const otherLeading = await repositories.find({
        collection: 'bids',
        where: {
          and: [
            { auction: { equals: auctionId } },
            { id: { not_equals: target.id } },
            { status: { equals: 'leading' } },
          ],
        },
        pagination: false,
        limit: 1000,
      })
      for (const otherBid of otherLeading.docs) {
        await repositories.update({
          collection: 'bids',
          id: otherBid.id,
          data: { status: 'lost' },
        })
      }
      await repositories.update({
        collection: 'auctions',
        id: auctionId,
        data: {
          status: 'appraised',
          winningBid: target.id,
          finalPriceCents: eurosToCents(top.amount),
        },
      })
      await upsertSnapshot(repositories, { objectType: auction.objectType, eur: top.amount })
      await prepareContract(auctionId, 'auction', target.user)
      const loserUserIds = [
        ...new Set(
          decrypted
            .filter((bid) => bid.valid && bid.user !== target.user)
            .map((bid) => bid.user),
        ),
      ]
      for (const loserId of loserUserIds) {
        eventBus.emit({
          type: 'auction.ended',
          userId: loserId,
          payload: {
            auctionId,
            auctionTitle: auction.title,
            type: 'sealed',
            hasWinner: true,
            finalPrice: top.amount,
          },
        })
      }
      await audit(repositories, {
        actorId: session.userId,
        action: 'sealed.winner_confirm',
        entityType: 'auction',
        entityId: auctionId,
        after: {
          bidId: target.id,
          decision: 'sold',
          finalPrice: top.amount,
          reauth: reauthMethod,
          openerUserId: record.opener.userId,
          approverUserId: record.approver?.userId ?? null,
        },
      })
      return null
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  })()
  if (failure !== null) {
    return { ok: false, phase: 'revealed', error: `Võitja kinnitamine ebaõnnestus: ${failure}` }
  }

  return { ok: true, phase: 'confirmed', error: null }
}

/**
 * Superadmin void of the sealed opening before the winner decision: every
 * sealed bid is rejected, the lot is declared unsold, and the `sealed.void`
 * audit entry — the same state location the legacy void writes — flips
 * `sealedCeremonyStateAction` to its read-only voided view. A second void
 * replays the same success like the one-shot reveal, without a duplicate
 * audit entry.
 */
export async function voidSealedBidsAction(
  _prev: SealedCeremonyActionState,
  formData: FormData,
): Promise<SealedCeremonyActionState> {
  const { session, repositories } = await requireAdminRepositories()
  const denied = ceremonyOperateOrError(session.role)
  if (denied) return { ok: false, phase: 'checklist', error: denied }

  const auctionId = readText(formData, 'auctionId')
  const reason = readText(formData, 'reason')

  // docs 05: the void path is superadmin-only with a typed reason.
  if (session.role !== 'superadmin') {
    return { ok: false, phase: 'checklist', error: 'Avamise tühistada saab ainult superadmin.' }
  }
  if (reason.length < MIN_REASON_LENGTH) {
    return {
      ok: false,
      phase: 'checklist',
      error: `Tühistamise põhjus on kohustuslik (vähemalt ${String(MIN_REASON_LENGTH)} tähemärki).`,
    }
  }

  const auction = await repositories.findByID({ collection: 'auctions', id: auctionId })
  if (!auction) return { ok: false, phase: 'checklist', error: 'Oksjonit ei leitud.' }

  // Idempotency precedes the status gate: a voided lot is already `unsold`,
  // so the replay must resolve before the ended-only eligibility check.
  const existing = await findCeremonyAuditEntry(repositories, 'sealed.void', auctionId)
  if (existing !== null) {
    return { ok: true, phase: 'unsold', error: null }
  }
  if (auction.status !== 'ended') {
    return {
      ok: false,
      phase: 'checklist',
      error: 'Tühistada saab enne võitja kinnitamist; pärast kinnitamist tühistab lepingu 08 moodulis.',
    }
  }

  const failure: string | null = await (async (): Promise<string | null> => {
    try {
      // Every sealed bid on the lot is voided; amounts were never revealed.
      const sealedBids = await getSealedBidsForAuction(auctionId)
      for (const bid of sealedBids) {
        const status = typeof bid.status === 'string' ? bid.status : ''
        if (status === 'rejected') continue
        const bidId = typeof bid.id === 'string' ? bid.id : ''
        if (bidId === '') continue
        await repositories.update({
          collection: 'bids',
          id: bidId,
          data: { status: 'rejected' },
        })
      }

      await repositories.update({
        collection: 'auctions',
        id: auctionId,
        data: { status: 'unsold' },
      })

      const bidderIds = [
        ...new Set(
          sealedBids
            .map((bid) => (typeof bid.userId === 'string' ? bid.userId : ''))
            .filter((userId) => userId !== ''),
        ),
      ]
      for (const bidderId of bidderIds) {
        eventBus.emit({
          type: 'auction.ended',
          userId: bidderId,
          payload: {
            auctionId,
            auctionTitle: auction.title,
            type: 'sealed',
            hasWinner: false,
            voided: true,
          },
        })
      }

      await audit(repositories, {
        actorId: session.userId,
        action: 'sealed.void',
        entityType: 'auction',
        entityId: auctionId,
        after: { reason, status: 'unsold', voidedBidCount: sealedBids.length },
      })

      await ceremonyCache.delete(ceremonyRecordKey(auctionId))
      return null
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  })()
  if (failure !== null) {
    return { ok: false, phase: 'checklist', error: `Avamise tühistamine ebaõnnestus: ${failure}` }
  }

  revalidatePath(auctionDetailPath(auctionId))
  revalidatePath(`${auctionDetailPath(auctionId)}/ceremony`)

  return { ok: true, phase: 'unsold', error: null }
}

// ── Bulk schedule (task 2.2) ────────────────────────────────────────────────
//
// Draft-only scheduling from the auctions list: every selected lot is
// scope-checked, then moved one immutable step (draft → scheduled) to a
// shared Tallinn wall-time start. Non-draft selections are rejected with an
// explicit list naming the offending rows (spec scenario).

export async function bulkScheduleAuctionsAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  const listPath = '/admin/auctions'
  assertPermissionOrRedirect(session.role, 'auctions:write', listPath)

  const ids = formData
    .getAll('ids')
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
    .map((entry) => entry.trim())
  if (ids.length === 0) {
    redirectWithError(listPath, 'Vali vähemalt üks oksjon.')
  }

  const startsIso = tallinnWallTimeToUtcIso(readText(formData, 'startsAt'))
  if (startsIso === null) {
    redirectWithError(listPath, 'Sisesta korrektne algusaeg (kellaaeg Europe/Tallinn).')
  }
  if (Date.parse(startsIso) <= Date.now()) {
    redirectWithError(listPath, 'Algusaeg peab olema tulevikus.')
  }
  const endsRaw = readText(formData, 'endsAt')
  let endsIso: string | null = null
  if (endsRaw !== '') {
    endsIso = tallinnWallTimeToUtcIso(endsRaw)
    if (endsIso === null) {
      redirectWithError(listPath, 'Sisesta korrektne lõppaeg (kellaaeg Europe/Tallinn).')
    }
    if (Date.parse(endsIso) <= Date.parse(startsIso)) {
      redirectWithError(listPath, 'Lõppaeg peab olema pärast algusaega.')
    }
  }

  // Reads run unscoped so in-scope drafts of any status are visible; the
  // per-row scope check below is the authorization boundary.
  const trusted = await getRepositories()
  const scope = auctionScope(session.role, session.userId)
  const offending: string[] = []
  const schedulable: AuctionDoc[] = []
  for (const id of ids) {
    const auction = await trusted
      .findByID({ collection: 'auctions', id })
      .catch(() => null)
    if (!auction) {
      offending.push(`#${id.slice(0, 8)} (ei leitud)`)
      continue
    }
    if (!auctionInScope(scope, { specialistId: auction.specialistId, sellerId: auction.sellerId })) {
      offending.push(`${auction.title} (pole teie tööulatuses)`)
      continue
    }
    if (auction.status !== 'draft') {
      offending.push(`${auction.title} (${auctionStatusLabels[auction.status]})`)
      continue
    }
    schedulable.push(auction)
  }

  if (offending.length > 0) {
    redirectWithError(
      listPath,
      `Ajastada saab ainult mustandeid. Blokeeritud read: ${offending.slice(0, 5).join('; ')}`,
    )
  }
  if (schedulable.length === 0) {
    redirectWithError(listPath, 'Ühtegi valitud oksjonit ei saa ajastada.')
  }

  let failure: string | null = null
  try {
    for (const auction of schedulable) {
      await repositories.update({
        collection: 'auctions',
        id: auction.id,
        data: {
          status: 'scheduled',
          startsAt: startsIso,
          ...(endsIso !== null ? { endsAt: endsIso } : {}),
          scheduledAt: startsIso,
        },
      })
    }
    await audit(repositories, {
      actorId: session.userId,
      action: 'auction.schedule',
      entityType: 'auction',
      entityId: 'bulk',
      after: {
        count: schedulable.length,
        startsAt: startsIso,
        ...(endsIso !== null ? { endsAt: endsIso } : {}),
        auctionIds: schedulable.map((auction) => auction.id),
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(listPath, `Bulks ajastamine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/auctions')
  redirectNotice(
    listPath,
    'teade',
    `Ajastatud ${String(schedulable.length)} oksjonit (olek: ajastatud).`,
  )
}

// ── Alapakkumine queue decisions (task 3.2) ─────────────────────────────────
//
// Global /admin/bids queue and per-auction blocks share these actions:
// underbids:decide permission plus auctionScope limiting (seller sees and
// decides only its own lots). The domain module serializes the state change
// and emits the notifications; a losing race surfaces the first decision
// (actor + time) from the audit chain instead of failing opaquely. Reject
// requires a typed reason of at least 5 characters.

const DECISION_AUDIT_ACTIONS: readonly string[] = [
  'bid.approve',
  'bid.reject',
  'bid_approved',
  'bid_rejected',
]

/** "Juba otsustatud (nimi, aeg)" from the first recorded decision. */
async function earlierDecisionMessage(
  trusted: CoreRepositories,
  bidId: string,
): Promise<string | null> {
  const entries = await trusted.find({
    collection: 'audit-entry',
    where: {
      and: [
        { entityType: { equals: 'bid' } },
        { entityId: { equals: bidId } },
        { action: { in: DECISION_AUDIT_ACTIONS } },
      ],
    },
    sort: '-createdAt',
    limit: 1,
  })
  const entry = entries.docs[0]
  if (!entry) return null
  let actorName: string | null = null
  try {
    const actor = await trusted.findByID({ collection: 'users', id: String(entry.actorId) })
    actorName = actor?.name ?? actor?.email ?? null
  } catch {
    actorName = null
  }
  const at = new Date(entry.createdAt)
  const atText = Number.isNaN(at.getTime())
    ? entry.createdAt
    : at.toLocaleString('et-EE', { dateStyle: 'short', timeStyle: 'short' })
  return `Juba otsustatud (${actorName ?? 'tundmatu tegija'}, ${atText}).`
}

async function loadAuctionForDecision(
  trusted: CoreRepositories,
  auctionId: string,
): Promise<AuctionDoc | null> {
  return trusted.findByID({ collection: 'auctions', id: auctionId }).catch(() => null)
}

export async function approveUnderbidAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  const feedbackPath = feedbackPathFrom(formData, '/admin/bids')
  try {
    assertCan(session.role, 'underbids:decide')
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      redirectNotice(feedbackPath, 'viga', error.message)
    }
    throw error
  }

  const auctionId = readText(formData, 'auctionId')
  const bidId = readText(formData, 'bidId')
  if (!auctionId || !bidId) {
    redirectWithError(feedbackPath, 'Pakkumuse otsustamiseks puudub identifikaator.')
  }

  const trusted = await getRepositories()
  const auction = await loadAuctionForDecision(trusted, auctionId)
  if (!auction) redirectWithError(feedbackPath, 'Oksjonit ei leitud.')
  if (
    !auctionInScope(auctionScope(session.role, session.userId), {
      specialistId: auction.specialistId,
      sellerId: auction.sellerId,
    })
  ) {
    redirectWithError(feedbackPath, 'Oksjon ei ole teie tööulatuses.')
  }

  const decision: ApproveDecision = await approveAlapakkumine(auctionId, bidId)
  if (decision.outcome !== 'approved') {
    if (decision.outcome === 'not_pending') {
      const earlier = await earlierDecisionMessage(trusted, bidId)
      redirectWithError(
        feedbackPath,
        earlier ?? `Pakkumus ei ole enam kinnitamisel (hetke olek: ${decision.status}).`,
      )
    }
    redirectWithError(feedbackPath, decisionFailure(decision.outcome, 'kinnitamine'))
  }

  await audit(repositories, {
    actorId: session.userId,
    action: 'bid.approve',
    entityType: 'bid',
    entityId: bidId,
    after: { auctionId, amountEur: decision.bid.amount, bidderNotified: true },
  })

  revalidatePath('/admin/bids')
  revalidatePath(auctionDetailPath(auctionId))
  revalidatePath(feedbackPath)
  redirectNotice(feedbackPath, 'teade', 'Alapakkumus kinnitatud ja juhtivaks seatud; osapooled teavitatud.')
}

export async function rejectUnderbidAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  const feedbackPath = feedbackPathFrom(formData, '/admin/bids')
  try {
    assertCan(session.role, 'underbids:decide')
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      redirectNotice(feedbackPath, 'viga', error.message)
    }
    throw error
  }

  const auctionId = readText(formData, 'auctionId')
  const bidId = readText(formData, 'bidId')
  const reason = readText(formData, 'reason')
  if (!auctionId || !bidId) {
    redirectWithError(feedbackPath, 'Pakkumuse otsustamiseks puudub identifikaator.')
  }
  if (reason.length < MIN_REASON_LENGTH) {
    redirectWithError(feedbackPath, reasonHint)
  }

  const trusted = await getRepositories()
  const auction = await loadAuctionForDecision(trusted, auctionId)
  if (!auction) redirectWithError(feedbackPath, 'Oksjonit ei leitud.')
  if (
    !auctionInScope(auctionScope(session.role, session.userId), {
      specialistId: auction.specialistId,
      sellerId: auction.sellerId,
    })
  ) {
    redirectWithError(feedbackPath, 'Oksjon ei ole teie tööulatuses.')
  }

  const decision: RejectDecision = await rejectAlapakkumine(auctionId, bidId)
  if (decision.outcome !== 'rejected') {
    if (decision.outcome === 'not_pending') {
      const earlier = await earlierDecisionMessage(trusted, bidId)
      redirectWithError(
        feedbackPath,
        earlier ?? `Pakkumus ei ole enam kinnitamisel (hetke olek: ${decision.status}).`,
      )
    }
    redirectWithError(feedbackPath, decisionFailure(decision.outcome, 'tagasilükkamine'))
  }

  await audit(repositories, {
    actorId: session.userId,
    action: 'bid.reject',
    entityType: 'bid',
    entityId: bidId,
    after: { auctionId, amountEur: decision.bid.amount, reason, bidderNotified: true },
  })

  revalidatePath('/admin/bids')
  revalidatePath(auctionDetailPath(auctionId))
  revalidatePath(feedbackPath)
  redirectNotice(feedbackPath, 'teade', 'Alapakkumus tagasi lükatud; pakkuja teavitatud põhjusega.')
}

// ── Audited identity reveal (task 3.2, design D5) ───────────────────────────
//
// The only path from an anonymized label to real identity. The
// `user.identity_view` audit entry is written BEFORE the identity value
// travels in the response; admin/superadmin see any in-scope lot, sellers
// only alapakkumine rows on their own lots.

export interface BidderIdentityView {
  name: string | null
  email: string
}

export type BidderIdentityReveal =
  | { ok: true; identity: BidderIdentityView }
  | { ok: false; error: string }

export async function revealBidderIdentityAction(bidId: string): Promise<BidderIdentityReveal> {
  const { session, repositories } = await requireAdminRepositories()
  if (bidId.trim() === '') {
    return { ok: false, error: 'Pakkumuse identifikaator puudub.' }
  }

  const trusted = await getRepositories()
  const bid = await trusted.findByID({ collection: 'bids', id: bidId }).catch(() => null)
  if (!bid) {
    return { ok: false, error: 'Pakkumust ei leitud.' }
  }

  const auction = await loadAuctionForDecision(trusted, bid.auctionId)
  if (!auction) {
    return { ok: false, error: 'Oksjonit ei leitud.' }
  }
  const scope = auctionScope(session.role, session.userId)
  if (!auctionInScope(scope, { specialistId: auction.specialistId, sellerId: auction.sellerId })) {
    return { ok: false, error: 'Oksjon ei ole teie tööulatuses.' }
  }

  // Sellers decide alapakkumised, but identity stays hidden everywhere else.
  if (session.role === 'seller' && bid.status !== 'pending_approval') {
    return { ok: false, error: 'Identiteet on nähtav ainult alapakkumise otsuse korral.' }
  }

  const bidderUserId = bid.userId
  try {
    // Design D5: the audit write strictly precedes the identity response.
    await audit(repositories, {
      actorId: session.userId,
      action: 'user.identity_view',
      entityType: 'user',
      entityId: bidderUserId,
      after: { bidId, auctionId: auction.id },
    })
  } catch {
    return { ok: false, error: 'Identiteedi avamine nurjus (auditikirje salvestamine ebaõnnestus).' }
  }

  const user = await trusted.findByID({ collection: 'users', id: bidderUserId }).catch(() => null)
  if (!user) {
    return { ok: false, error: 'Pakkujat ei leitud.' }
  }
  return { ok: true, identity: { name: user.name ?? null, email: user.email } }
}
