'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'
import { auctionStatusLabels, maskIsikukood } from '../_lib/labels'
import {
  assertCan,
  auctionInScope,
  auctionScope,
  can,
  PermissionDeniedError,
  type StaffRole,
} from '../_lib/permissions'
import {
  SUCCESS_FEE_PERCENT_DEFAULT,
  successFeeCents,
  VAT_PERCENT,
} from '../admin/_lib/workspace'
import {
  applyQuickAuctionDefaults,
  auctionInputSchema,
  collectPublishGateFailures,
  collectPublishReadinessFailures,
  slugifyTitle,
  toAuctionWriteData,
  type AuctionGateSubject,
  type AuctionInput,
  type AuctionWriteData,
  type PublishGateFailure,
  type PublishReadinessSubject,
} from '../admin/auctions/_lib/auction-schema'
import { tallinnWallTimeToUtcIso } from '../admin/content/_components/scheduled-publish'
import { readAuctionDefaults } from '../admin/content/_components/settings-audit'

import { verifyAdminAccessToken } from '@/lib/auth/jwt'
import { verifyPassword } from '@/lib/auth/password'
import {
  approveAlapakkumine,
  rejectAlapakkumine,
  type ApproveDecision,
  type RejectDecision,
} from '@/lib/bidding/alapakkumine'
import { clampAntiSnipeMinutes } from '@/lib/bidding/anti-snipe'
import { computeIpHash } from '@/lib/bidding/place-bid'
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
import type { AuctionDoc, CoreRepositories, SettingsDoc } from '@/lib/data/repositories'
import { centsToEuros, eurosToCents } from '@/lib/data/repositories/money'
import { getRepositories } from '@/lib/data/runtime'
import { eventBus } from '@/lib/notifications/event-bus'
import { adminUrl } from '@/lib/routing/admin-base-server'
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

async function redirectWithError(path: string, message: string): Promise<never> {
  redirect(await adminUrl(`${path}?viga=${encodeURIComponent(message)}`))
}

/** Appends a notice param to a path that may already carry a query string. */
function noticePath(path: string, key: 'teade' | 'viga', message: string): string {
  const joiner = path.includes('?') ? '&' : '?'
  return `${path}${joiner}${key}=${encodeURIComponent(message)}`
}

async function redirectNotice(path: string, key: 'teade' | 'viga', message: string): Promise<never> {
  redirect(await adminUrl(noticePath(path, key, message)))
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

/** Wizard submit intent behind the three footer buttons (task 5.5). */
type WizardIntent = 'draft' | 'schedule' | 'publish'

function wizardIntent(formData: FormData): WizardIntent {
  const value = readText(formData, 'intent')
  return value === 'schedule' || value === 'publish' ? value : 'draft'
}

/** Gate inputs from the stored (or just-written) lot row. */
function gateSubjectOfAuction(auction: AuctionDoc): AuctionGateSubject {
  return {
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
  }
}

function readinessSubjectOfAuction(auction: AuctionDoc): PublishReadinessSubject {
  return {
    specialistId: typeof auction.specialistId === 'string' ? auction.specialistId : null,
    startsAt: typeof auction.startsAt === 'string' ? auction.startsAt : null,
    areaHa: typeof auction.areaHa === 'number' ? auction.areaHa : null,
    minBidCents: typeof auction.minBidCents === 'number' ? auction.minBidCents : null,
    deadlines: auction.deadlines,
    packageRows: auction.packageRows,
  }
}

function blockingGateSummary(blocking: PublishGateFailure[]): string {
  return blocking
    .slice(0, 5)
    .map((gate) => `${gate.step} → ${gate.message}`)
    .join(' | ')
}

/**
 * Accepts both payload shapes: the wizard's JSON `payload` field and the
 * legacy flat form keys. Numbers arrive as strings from FormData; arrays
 * arrive as newline/comma separated text.
 */
async function formToAuctionInput(formData: FormData): Promise<Record<string, unknown>> {
  const payloadJson = readText(formData, 'payload')
  if (payloadJson) {
    try {
      const parsed = JSON.parse(payloadJson) as unknown
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return redirectWithError(newAuctionPath, 'Vigane vormi andmete JSON.')
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

async function parseAuctionInputOrRedirect(raw: Record<string, unknown>, path: string): Promise<AuctionInput> {
  const parsed = auctionInputSchema.safeParse(raw)
  if (!parsed.success) {
    const summary = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || 'vorm'}: ${issue.message}`)
      .join('; ')
    return redirectWithError(path, `Oksjoni andmed ei läbinud valideerimist: ${summary}`)
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
  // Real columns (migration 0018); the deadlines JSON mirror still travels
  // through toAuctionWriteData for guest preview reads.
  areaHa: 'areaHa',
  volumeM3: 'volumeM3',
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
  entry: {
    actorId: string
    action: string
    entityType: string
    entityId: string
    after: unknown
    reason?: string
    context?: {
      sessionId: string | null
      ipHash: string | null
      userAgent: string | null
    }
  },
): Promise<unknown> {
  const context = entry.context
  return repositories.create({
    collection: 'audit-entry',
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      after: entry.after,
      ...(entry.reason ? { reason: entry.reason } : {}),
      ...(context?.sessionId ? { sessionId: context.sessionId } : {}),
      ...(context?.ipHash ? { ipHash: context.ipHash } : {}),
      ...(context?.userAgent ? { userAgent: context.userAgent } : {}),
    },
  })
}

/**
 * Request context for the audit era columns (task 4.7): session id from the
 * access token, salted IP hash and user agent from the request headers.
 * Best-effort only — outside a request scope the fields fall back to null.
 */
async function auditRequestContext(): Promise<{
  sessionId: string | null
  ipHash: string | null
  userAgent: string | null
}> {
  try {
    const headerList = await headers()
    const token = (await cookies()).get('access_token')?.value
    const payload = token ? verifyAdminAccessToken(token) : null
    const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim()
    const userAgent = headerList.get('user-agent')?.trim()
    return {
      sessionId: payload?.sessionId ?? null,
      ipHash: ip && ip.length > 0 ? computeIpHash(ip) : null,
      userAgent: userAgent && userAgent.length > 0 ? userAgent.slice(0, 512) : null,
    }
  } catch {
    return { sessionId: null, ipHash: null, userAgent: null }
  }
}

export async function createAuctionAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const intent = wizardIntent(formData)
  const raw = await formToAuctionInput(formData)
  const input = await parseAuctionInputOrRedirect(raw, newAuctionPath)
  const writeData = toAuctionWriteData(input)

  // Specialist lots are always their own; assigning another specialist is a
  // governance write (deny-listed for the specialist role).
  let specialistId = typeof writeData.specialistId === 'string' ? writeData.specialistId : undefined
  if (session.role === 'specialist') {
    if (specialistId && specialistId !== session.userId) {
      await assertPermissionOrRedirect(session.role, 'auctions:reassign-specialist', newAuctionPath)
    }
    specialistId = session.userId
  }

  if (writeData.feeOverridePercent !== undefined) {
    await assertPermissionOrRedirect(session.role, 'auctions:fee-override', newAuctionPath)
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
    return redirectWithError(newAuctionPath, `Oksjoni loomine ebaõnnestus: ${failure ?? 'tundmatu viga'}`)
  }

  // The draft exists at this point, so a failed gate lands back on the new
  // lot's editor with the draft preserved; success notices go to the detail.
  if (intent !== 'draft') {
    await applyWizardIntent(
      repositories,
      session.userId,
      intent,
      { error: `${auctionDetailPath(created.id)}/edit`, notice: auctionDetailPath(created.id) },
      created,
    )
  }

  revalidatePath('/admin/auctions')
  redirect(await adminUrl(auctionDetailPath(created.id)))
}

export async function updateAuctionAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  const detailPath = auctionDetailPath(id)
  const editPath = `${detailPath}/edit`
  const intent = wizardIntent(formData)
  if (!id) return redirectWithError('/admin/auctions', 'Muudatuseks puudub oksjoni identifikaator.')

  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) return redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  await assertScopeOrRedirect(session.role, session.userId, auction, editPath)
  await assertPermissionOrRedirect(session.role, 'auctions:write', editPath)

  const raw = await formToAuctionInput(formData)
  const input = await parseAuctionInputOrRedirect(raw, editPath)
  const writeData = toAuctionWriteData(input)

  // An active (or scheduled) lot locks its mechanics: only content fields
  // may change; force requires manual end + re-list (docs 03 interactions).
  // Admin/superadmin may push mechanic changes through the lock by posting
  // mechanicsOverride=true; the override is recorded in the audit entry.
  const mechanicsLocked = auction.status === 'active' || auction.status === 'scheduled'
  const overrideRequested = readText(formData, 'mechanicsOverride') === 'true'
  const canOverrideMechanics = session.role === 'admin' || session.role === 'superadmin'
  let mechanicsOverridden = false
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
      if (overrideRequested && canOverrideMechanics) {
        mechanicsOverridden = true
      } else {
        return redirectWithError(editPath, 'Aktiivse oksjoni mehaanikat muuta ei saa.')
      }
    }
  }

  // Specialist reassignment is deny-listed for specialists and audited for
  // admin+; specialists always keep their own lots.
  const requestedSpecialist =
    input.specialistId !== undefined && input.specialistId !== '' ? input.specialistId : undefined
  if (session.role === 'specialist') {
    if (requestedSpecialist && requestedSpecialist !== session.userId) {
      await assertPermissionOrRedirect(session.role, 'auctions:reassign-specialist', editPath)
    }
    writeData.specialistId = session.userId
  } else if (requestedSpecialist && requestedSpecialist !== auction.specialistId) {
    await assertPermissionOrRedirect(session.role, 'auctions:reassign-specialist', editPath)
  }

  const reserveChanged = input.reservePriceEur !== undefined
  const feeChanged =
    input.feeOverridePercent !== undefined && input.feeOverridePercent !== auction.feeOverridePercent
  if (feeChanged) {
    await assertPermissionOrRedirect(session.role, 'auctions:fee-override', editPath)
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
        ...(mechanicsOverridden ? { mechanicsOverride: true } : {}),
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(editPath, `Oksjoni salvestamine ebaõnnestus: ${failure}`)
  }

  // Ajasta/Avalda kohe run their gates against the just-persisted state;
  // locked lots (active/ended/…) fall back to a plain content save.
  if (intent !== 'draft' && (auction.status === 'draft' || auction.status === 'scheduled')) {
    await applyWizardIntent(repositories, session.userId, intent, { error: detailPath, notice: detailPath }, {
      ...auction,
      ...updateData,
      specialistId: writeData.specialistId ?? auction.specialistId,
    })
  }

  revalidatePath('/admin/auctions')
  revalidatePath(detailPath)
  redirect(await adminUrl(detailPath))
}

export interface AuctionAutosaveResult {
  ok: boolean
  /**
   * True when the stored copy was written by someone else after the
   * client's base updatedAt; the stored lot is left untouched and the
   * wizard shows the conflict banner with the takeover option (task 5.6).
   */
  conflict: boolean
  /** Server save time (UTC ISO) on success; null otherwise. */
  savedAt: string | null
  /** Current server updatedAt — the client's next conflict base. */
  updatedAt: string | null
  error: string | null
}

/**
 * Background draft autosave behind the wizard's idle/step/blur triggers
 * (task 5.6): the 5.5 mustand path without the redirect. Same permission,
 * scope, schema and partial-update semantics as updateAuctionAction, but
 * failures and conflicts come back as values so the editor bar can show
 * them instead of navigating away. Draft content only — the status never
 * changes here and the mechanics of a scheduled/active lot are refused.
 */
export async function autosaveAuctionDraftAction(
  id: string,
  payloadJson: string,
  baseUpdatedAt: string | null,
): Promise<AuctionAutosaveResult> {
  const { session, repositories } = await requireAdminRepositories()
  const fail = (
    error: string,
    conflict = false,
    updatedAt: string | null = null,
  ): AuctionAutosaveResult => ({ ok: false, conflict, savedAt: null, updatedAt, error })

  try {
    assertCan(session.role, 'auctions:write')
  } catch (error) {
    if (error instanceof PermissionDeniedError) return fail(error.message)
    throw error
  }
  if (id.trim() === '') {
    return fail('Mustandi salvestamiseks puudub oksjoni identifikaator.')
  }
  const auction = await repositories
    .findByID({ collection: 'auctions', id })
    .catch(() => null)
  if (!auction) return fail('Oksjonit ei leitud.')
  if (
    !auctionInScope(auctionScope(session.role, session.userId), {
      specialistId: auction.specialistId,
      sellerId: auction.sellerId,
    })
  ) {
    return fail('Oksjon ei ole teie tööulatuses.')
  }

  let raw: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(payloadJson)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object')
    }
    raw = parsed as Record<string, unknown>
  } catch {
    return fail('Vigane mustandi andmete JSON.')
  }
  const parsedInput = auctionInputSchema.safeParse(raw)
  if (!parsedInput.success) {
    const summary = parsedInput.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || 'vorm'}: ${issue.message}`)
      .join('; ')
    return fail(`Oksjoni andmed ei läbinud valideerimist: ${summary}`)
  }
  const input = applyQuickAuctionDefaults(parsedInput.data)
  const writeData = toAuctionWriteData(input)

  // Optimistic concurrency: a newer server copy means another staff member
  // saved in between — never overwrite; the client takes over explicitly.
  if (baseUpdatedAt !== null && auction.updatedAt !== baseUpdatedAt) {
    return fail('Mustand on vahepeal serveris uuendatud.', true, auction.updatedAt)
  }

  // Mirror of updateAuctionAction's mechanics lock; autosave carries no
  // override path — the wizard payload omits mechanics on locked lots, so a
  // present changed mechanic means a stale or tampered client.
  if (auction.status === 'active' || auction.status === 'scheduled') {
    const mechanicsConflict =
      (input.startsAt !== undefined && input.startsAt !== auction.startsAt) ||
      (input.endsAt !== undefined && input.endsAt !== auction.endsAt) ||
      (input.auctionType !== auction.type) ||
      (input.objectType !== auction.objectType)
    if (mechanicsConflict) {
      return fail('Aktiivse oksjoni mehaanikat muuta ei saa.')
    }
  }

  if (session.role === 'specialist') {
    writeData.specialistId = session.userId
  }
  const feeChanged =
    input.feeOverridePercent !== undefined &&
    input.feeOverridePercent !== auction.feeOverridePercent
  if (feeChanged) {
    try {
      assertCan(session.role, 'auctions:fee-override')
    } catch (error) {
      if (error instanceof PermissionDeniedError) return fail(error.message)
      throw error
    }
  }

  const updateData = restrictToPresentKeys(writeData, raw)
  try {
    const updated = await repositories.update({
      collection: 'auctions',
      id,
      data: updateData,
    })
    const updatedAt =
      typeof updated.updatedAt === 'string'
        ? updated.updatedAt
        : new Date().toISOString()
    await audit(repositories, {
      actorId: session.userId,
      action: 'auction.autosave',
      entityType: 'auction',
      entityId: id,
      after: {
        // Field names only: values (and the reserve fact) never travel
        // into the audit entry (D5/D7).
        fields: Object.keys(updateData).sort(),
        ...(baseUpdatedAt === null ? { adoptedBase: true } : {}),
      },
    })
    return { ok: true, conflict: false, savedAt: new Date().toISOString(), updatedAt, error: null }
  } catch (error) {
    return fail(
      `Mustandi salvestamine ebaõnnestus: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export async function deleteAuctionAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) return redirectWithError('/admin/auctions', 'Kustutamiseks puudub oksjoni identifikaator.')

  let failure: string | null = null
  try {
    await repositories.delete({ collection: 'auctions', id })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError('/admin/auctions', `Oksjoni kustutamine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/auctions')
  redirect(await adminUrl('/admin/auctions'))
}

const MIN_REASON_LENGTH = 5

const reasonHint = `Kirjuta põhjus (vähemalt ${String(MIN_REASON_LENGTH)} tähemärki).`

/** Permission denied becomes an explicit Estonian redirect error, never a silent no-op. */
async function assertPermissionOrRedirect(
  role: StaffRole,
  permission: Parameters<typeof assertCan>[1],
  path: string,
): Promise<void> {
  try {
    assertCan(role, permission)
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return redirectWithError(path, error.message)
    }
    throw error
  }
}

async function assertScopeOrRedirect(
  role: StaffRole,
  userId: string,
  auction: { specialistId?: string | null; sellerId?: string | null },
  path: string,
): Promise<void> {
  const scope = auctionScope(role, userId)
  if (!auctionInScope(scope, auction)) {
    return redirectWithError(path, 'Oksjon ei ole teie tööulatuses.')
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
      areaHa: auction.areaHa,
      volumeM3: auction.volumeM3,
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
 * Anti-snipe re-check for the manual end: while the newest bid sits inside
 * the current per-auction anti-snipe window, the end time must be allowed
 * to extend first, so the manual end is refused and the operator retries
 * after the extension. Sealed lots never anti-snipe (checkAntiSnipe), and
 * lots with the toggle off end freely. Returns the Estonian block message
 * or null when the end may go through.
 */
async function antiSnipeManualEndBlock(
  repositories: CoreRepositories,
  auction: AuctionDoc,
): Promise<string | null> {
  if (auction.type === 'sealed') return null
  const deadlines =
    auction.deadlines !== null && typeof auction.deadlines === 'object'
      ? (auction.deadlines as Record<string, unknown>)
      : null
  if (deadlines?.antiSnipeEnabled !== true) return null

  const endsAtMs = typeof auction.endsAt === 'string' ? Date.parse(auction.endsAt) : Number.NaN
  if (!Number.isFinite(endsAtMs)) return null

  const rawMinutes = deadlines.antiSnipeMinutes
  const minutes = clampAntiSnipeMinutes(typeof rawMinutes === 'number' ? rawMinutes : undefined)
  const windowStartMs = endsAtMs - minutes * 60_000
  if (Date.now() < windowStartMs) return null

  const newest = await repositories.find({
    collection: 'bids',
    where: { and: [{ auction: { equals: auction.id } }] },
    sort: '-createdAt',
    limit: 1,
  })
  const newestCreatedAt = newest.docs[0]?.createdAt
  const newestMs =
    typeof newestCreatedAt === 'string' ? Date.parse(newestCreatedAt) : Number.NaN
  if (!Number.isFinite(newestMs) || newestMs < windowStartMs) return null

  return (
    `Antissnipe: oksjonile tuli pakkumine viimase ${String(minutes)} minuti jooksul ` +
    'ja lõpuaeg pikeneb. Proovi lõpetamist pärast pikendust uuesti.'
  )
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
  if (!id) return redirectWithError('/admin/auctions', 'Lõpetamiseks puudub oksjoni identifikaator.')
  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) return redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  const detailPath = auctionDetailPath(id)
  // The monitor modal returns to its own screen; the list stays on the list.
  const feedbackPath = feedbackPathFrom(formData, detailPath)

  await assertPermissionOrRedirect(session.role, 'auctions:end-manual', detailPath)
  await assertScopeOrRedirect(session.role, session.userId, auction, detailPath)
  if (auction.status !== 'active') {
    return redirectWithError(feedbackPath, 'Käsitsi saab lõpetada ainult aktiivset oksjonit.')
  }

  const reason = readText(formData, 'reason')
  const outcome = readText(formData, 'outcome')
  if (reason.length < MIN_REASON_LENGTH) {
    return redirectWithError(feedbackPath, reasonHint)
  }
  if (outcome !== 'winner' && outcome !== 'unsold') {
    return redirectWithError(feedbackPath, 'Vali lõpetamise tulemus: võitja kuulutamine või müümata märkimine.')
  }

  const antiSnipeBlock = await antiSnipeManualEndBlock(repositories, auction)
  if (antiSnipeBlock !== null) return redirectWithError(feedbackPath, antiSnipeBlock)

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
    return redirectWithError(feedbackPath, 'Juhtivat pakkumust ei ole; märgi oksjon müümata.')
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
    return redirectWithError(
      feedbackPath,
      `Käsitsi lõpetamine ebaõnnestus: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  revalidatePath('/admin/auctions')
  revalidatePath(detailPath)
  revalidatePath(feedbackPath)
  redirect(
    await adminUrl(
      noticePath(
        feedbackPath,
        'teade',
        outcome === 'winner' ? 'Oksjon lõpetatud; juhtiv pakkumus kuulutatud võitjaks.' : 'Oksjon lõpetatud ja märgitud müümata.',
      ),
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
  if (!id) return redirectWithError('/admin/auctions', 'Arhiiveerimiseks puudub oksjoni identifikaator.')
  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) return redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  const detailPath = auctionDetailPath(id)

  await assertPermissionOrRedirect(session.role, 'auctions:archive', detailPath)
  await assertScopeOrRedirect(session.role, session.userId, auction, detailPath)

  const reason = readText(formData, 'reason')
  if (reason.length < MIN_REASON_LENGTH) {
    return redirectWithError(detailPath, reasonHint)
  }

  const from = auction.status
  if (from !== 'unsold' && from !== 'completed') {
    return redirectWithError(
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
    return redirectWithError(
      detailPath,
      `Arhiiveerimine ebaõnnestus: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  revalidatePath('/admin/auctions')
  revalidatePath(detailPath)
  redirect(await adminUrl(`${detailPath}?teade=${encodeURIComponent('Oksjon arhiivitud.')}`))
}

/**
 * Re-list (docs 02 "Avalda uuesti"): clone an ended or unsold lot into a
 * fresh draft with cleared schedule; the original keeps its finalPrice.
 */
export async function relistAuctionAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) return redirectWithError('/admin/auctions', 'Uuesti avaldamiseks puudub oksjoni identifikaator.')
  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) return redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  const detailPath = auctionDetailPath(id)

  await assertPermissionOrRedirect(session.role, 'auctions:write', detailPath)
  await assertScopeOrRedirect(session.role, session.userId, auction, detailPath)
  if (auction.status !== 'ended' && auction.status !== 'unsold') {
    return redirectWithError(detailPath, 'Uuesti saab avaldada lõppenud või müümata märgitud oksjonit.')
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
    return redirectWithError(detailPath, `Uuesti avaldamine ebaõnnestus: ${failure ?? 'tundmatu viga'}`)
  }

  revalidatePath('/admin/auctions')
  redirect(await adminUrl(`/admin/auctions/${clone.id}/edit`))
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

/**
 * Status transition behind "Avalda kohe" / publish (docs 02, task 5.5):
 * draft -> active must pass through scheduled, the guard chain is
 * draft -> scheduled -> active and each update is one step. Emits the
 * `auction.publish` audit entry and the DO broadcast.
 */
async function publishAuctionRow(
  repositories: CoreRepositories,
  auction: AuctionDoc,
  options: { actorId: string; auditNote?: string | null; warnings?: PublishGateFailure[] },
): Promise<'scheduled' | 'active'> {
  const nowIso = new Date().toISOString()
  const startsAtMs = typeof auction.startsAt === 'string' ? Date.parse(auction.startsAt) : Number.NaN
  const target: 'scheduled' | 'active' = startsAtMs > Date.now() ? 'scheduled' : 'active'
  // draft -> active must pass through scheduled; the guard chain is
  // draft -> scheduled -> active and each update is one step.
  if (auction.status === 'draft' && target === 'active') {
    await repositories.update({
      collection: 'auctions',
      id: auction.id,
      data: { status: 'scheduled', scheduledAt: auction.startsAt },
    })
  }
  await repositories.update({
    collection: 'auctions',
    id: auction.id,
    data:
      target === 'scheduled'
        ? { status: 'scheduled', scheduledAt: auction.startsAt }
        : { status: 'active', activatedAt: nowIso },
  })
  await audit(repositories, {
    actorId: options.actorId,
    action: 'auction.publish',
    entityType: 'auction',
    entityId: auction.id,
    after: {
      status: target,
      ...(options.auditNote ? { auditNote: options.auditNote } : {}),
      ...(options.warnings && options.warnings.length > 0 ? { warnings: options.warnings } : {}),
    },
  })
  await broadcastAuctionPublished(auction.id)
  return target
}

/**
 * Ajasta / Avalda kohe after a wizard save (task 5.5). Runs the readiness
 * gates against the just-persisted lot, then walks the immutable status
 * chain one step at a time. Always redirects; never returns.
 */
async function applyWizardIntent(
  repositories: CoreRepositories,
  actorId: string,
  intent: 'schedule' | 'publish',
  paths: { error: string; notice: string },
  auction: AuctionDoc,
): Promise<never> {
  if (intent === 'schedule') {
    const timingGate = collectPublishReadinessFailures(readinessSubjectOfAuction(auction)).find(
      (gate) => gate.field === 'startsAt',
    )
    if (timingGate) {
      return redirectWithError(paths.error, `Ajastamine ei ole lubatud: ${timingGate.message}`)
    }
    if (!auction.endsAt || Date.parse(auction.endsAt) <= Date.parse(auction.startsAt ?? '')) {
      return redirectWithError(paths.error, 'Ajastamiseks määra lõppaeg pärast algusaega.')
    }
    await repositories.update({
      collection: 'auctions',
      id: auction.id,
      data: { status: 'scheduled', scheduledAt: auction.startsAt },
    })
    await audit(repositories, {
      actorId,
      action: 'auction.schedule',
      entityType: 'auction',
      entityId: auction.id,
      after: { status: 'scheduled', startsAt: auction.startsAt, endsAt: auction.endsAt },
    })
    revalidatePath('/admin/auctions')
    revalidatePath(paths.notice)
    return redirectNotice(paths.notice, 'teade', 'Oksjon ajastatud.')
  }

  const blocking = [
    ...collectPublishGateFailures(gateSubjectOfAuction(auction)).blocking,
    ...collectPublishReadinessFailures(readinessSubjectOfAuction(auction)),
  ]
  if (blocking.length > 0) {
    return redirectWithError(paths.error, `Avaldamine on blokeeritud: ${blockingGateSummary(blocking)}`)
  }

  await publishAuctionRow(repositories, auction, { actorId })

  revalidatePath('/admin/auctions')
  revalidatePath(paths.notice)
  return redirectNotice(paths.notice, 'teade', 'Oksjon on avaldatud.')
}

export async function publishAuctionAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) return redirectWithError('/admin/auctions', 'Avalikustamiseks puudub oksjoni identifikaator.')
  const detailPath = auctionDetailPath(id)

  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) return redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  await assertScopeOrRedirect(session.role, session.userId, auction, detailPath)
  await assertPermissionOrRedirect(session.role, 'auctions:write', detailPath)

  if (auction.status !== 'draft' && auction.status !== 'scheduled') {
    return redirectWithError(detailPath, 'Avalikustada saab ainult mustandit või ajastatud oksjoni.')
  }
  if (!auction.startsAt || !auction.endsAt) {
    return redirectWithError(detailPath, 'Avalikustamiseks määra oksjonile algus- ja lõppaeg.')
  }
  if (Date.parse(auction.endsAt) <= Date.parse(auction.startsAt)) {
    return redirectWithError(detailPath, 'Lõppaeg peab olema pärast algusaega.')
  }
  if (Date.parse(auction.endsAt) <= Date.now()) {
    return redirectWithError(detailPath, 'Lõppaeg peab olema tulevikus.')
  }

  // Publish gates (docs 03 validation summary): blocking failures stop the
  // publish, warnings travel in the audit entry without blocking. The
  // readiness gates (specialist, 10-minute lead, area) apply on top.
  const gates = collectPublishGateFailures(gateSubjectOfAuction(auction))
  const blocking = [
    ...gates.blocking,
    ...collectPublishReadinessFailures(readinessSubjectOfAuction(auction)),
  ]
  if (blocking.length > 0) {
    return redirectWithError(detailPath, `Avaldamine on blokeeritud: ${blockingGateSummary(blocking)}`)
  }

  const auditNote = readOptionalText(formData, 'auditNote')

  let failure: string | null = null
  let target: 'scheduled' | 'active' = 'scheduled'
  try {
    target = await publishAuctionRow(repositories, auction, {
      actorId: session.userId,
      auditNote,
      warnings: gates.warnings,
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(detailPath, `Avalikustamine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/auctions')
  revalidatePath(detailPath)
  redirect(
    await adminUrl(
      `${detailPath}?teade=${encodeURIComponent(
        target === 'scheduled' ? 'Oksjon ajastatud ja avalikustatud.' : 'Oksjon on aktiivne.',
      )}`,
    ),
  )
}

/**
 * Editor duplicate (docs 02/03): a draft copy with cleared schedule; the
 * original is untouched. Lifecycle fields reset through the shared clone.
 */
export async function duplicateAuctionAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) return redirectWithError('/admin/auctions', 'Dubleerimiseks puudub oksjoni identifikaator.')
  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) return redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  const detailPath = auctionDetailPath(id)

  await assertPermissionOrRedirect(session.role, 'auctions:write', detailPath)
  await assertScopeOrRedirect(session.role, session.userId, auction, detailPath)

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
    return redirectWithError(detailPath, `Dubleerimine ebaõnnestus: ${failure ?? 'tundmatu viga'}`)
  }

  revalidatePath('/admin/auctions')
  redirect(await adminUrl(`${auctionDetailPath(clone.id)}/edit?teade=${encodeURIComponent('Koopia loodud mustandina.')}`))
}

/**
 * Alias e-mail regenerate (docs 03 step 5): a fresh inbound address for
 * the lot; the old address stops receiving after the switch. Audited.
 */
export async function regenerateAliasEmailAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) return redirectWithError('/admin/auctions', 'Aadressi vahetuseks puudub oksjoni identifikaator.')
  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) return redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  const detailPath = auctionDetailPath(id)

  await assertPermissionOrRedirect(session.role, 'auctions:write', detailPath)
  await assertScopeOrRedirect(session.role, session.userId, auction, detailPath)

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
    return redirectWithError(detailPath, `Aadressi vahetus ebaõnnestus: ${failure}`)
  }

  revalidatePath(detailPath)
  redirect(await adminUrl(`${detailPath}?teade=${encodeURIComponent(`Uus alias-aadress: ${aliasEmail}`)}`))
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
    return redirectWithError('/admin/auctions', 'Pakkumuse otsustamiseks puudub identifikaator.')
  }
  const detailPath = auctionDetailPath(auctionId)

  const decision: ApproveDecision = await approveAlapakkumine(auctionId, bidId)
  if (decision.outcome !== 'approved') {
    return redirectWithError(
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
  redirect(await adminUrl(`${detailPath}?teade=${encodeURIComponent('Alapakkumus kinnitatud ja juhtivaks seatud.')}`))
}

export async function rejectAuctionBidAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const auctionId = readText(formData, 'auctionId')
  const bidId = readText(formData, 'bidId')
  if (!auctionId || !bidId) {
    return redirectWithError('/admin/auctions', 'Pakkumuse otsustamiseks puudub identifikaator.')
  }
  const detailPath = auctionDetailPath(auctionId)
  const reason = readText(formData, 'reason')
  if (reason.length < MIN_REASON_LENGTH) {
    return redirectWithError(detailPath, reasonHint)
  }

  const decision: RejectDecision = await rejectAlapakkumine(auctionId, bidId, reason)
  if (decision.outcome !== 'rejected') {
    return redirectWithError(
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
    after: { auctionId, amountEur: decision.bid.amount, reason, bidderNotified: true },
  })

  revalidatePath(detailPath)
  redirect(await adminUrl(`${detailPath}?teade=${encodeURIComponent('Alapakkumus tagasi lükatud; pakkuja teavitatud põhjusega.')}`))
}

export async function generateContractAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const auctionId = readText(formData, 'auctionId')
  if (!auctionId) {
    return redirectWithError('/admin/auctions', 'Lepingu koostamiseks puudub oksjoni identifikaator.')
  }
  const detailPath = auctionDetailPath(auctionId)

  const auction = await repositories.findByID({ collection: 'auctions', id: auctionId })
  if (!auction) return redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  if (auction.status !== 'appraised') {
    return redirectWithError(detailPath, 'Lepingu saab koostada ainult hinnatud (võitjaga) oksjonile.')
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
    return redirectWithError(detailPath, `Lepingu koostamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(detailPath)
  redirect(
    await adminUrl(`${detailPath}?teade=${encodeURIComponent(`Leping ${contractId} koostatud.`)}`),
  )
}

export interface RevealedBidderIdentity {
  name: string | null
  email: string | null
  /** Isikukood või registrikood maskeeritult (D-16: viimased 4 märki nähtavad). */
  maskedCode: string | null
  /** Company chip shows for registrikood bidders. */
  isCompany: boolean
  userId: string | null
  /** User detail link; set server-side only for roles holding users:read. */
  userHref: string | null
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
  /** Marginaal: hälvik järgmise kehtiva pakkumise suhtes (eurot); viimasel null. */
  marginToNext?: number | null
  /**
   * Identity travels only on the ceremony's post-reveal read model, never
   * on live bids; null when the snapshot is missing or undecryptable.
   */
  bidder?: RevealedBidderIdentity | null
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
    return redirectWithError('/admin/auctions', 'Tühistamiseks puudub oksjoni identifikaator.')
  }
  const detailPath = auctionDetailPath(auctionId)
  const ceremonyPath = `${detailPath}/ceremony`

  // docs 05: the void path is superadmin-only with a typed reason.
  if (session.role !== 'superadmin') {
    return redirectWithError(ceremonyPath, 'Avamise tühistada saab ainult superadmin.')
  }
  const reason = readText(formData, 'reason')
  if (reason.length < MIN_REASON_LENGTH) {
    return redirectWithError(ceremonyPath, `Tühistamise põhjus on kohustuslik (vähemalt ${String(MIN_REASON_LENGTH)} tähemärki).`)
  }

  const auction = await repositories.findByID({ collection: 'auctions', id: auctionId })
  if (!auction) return redirectWithError('/admin/auctions', 'Oksjonit ei leitud.')
  if (auction.status !== 'ended') {
    return redirectWithError(
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
      reason,
      context: await auditRequestContext(),
    })

    await ceremonyCache.delete(ceremonyRecordKey(auctionId))
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(ceremonyPath, `Avamise tühistamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(detailPath)
  revalidatePath(ceremonyPath)
  redirect(await adminUrl(`${detailPath}?teade=${encodeURIComponent('Oksjon tühistatud ja kuulutatud müümata.')}`))
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

/** Success fee percent: per-auction override, then the global Tasud setting, then the default. */
function feePercentFor(auction: AuctionDoc, settingsDoc: SettingsDoc | undefined): number {
  const override = auction.feeOverridePercent
  if (typeof override === 'number') return override
  const globalFee = settingsDoc?.feePercent
  return typeof globalFee === 'number' ? globalFee : SUCCESS_FEE_PERCENT_DEFAULT
}

export interface SealedCeremonyFeeEstimate {
  feeCents: number
  feePercent: number
  vatPercent: number
}

/** Fee estimate for the ceremony winner modal: 3% + VAT charged on completion. */
function feeEstimateFor(
  topBidEuros: number,
  auction: AuctionDoc,
  settingsDoc: SettingsDoc | undefined,
): SealedCeremonyFeeEstimate {
  const feePercent = feePercentFor(auction, settingsDoc)
  return {
    feeCents: successFeeCents(eurosToCents(topBidEuros), feePercent),
    feePercent,
    vatPercent: VAT_PERCENT,
  }
}

/** "Ettevõtte profiil ootel": company profile awaiting approval for a bidder. */
async function companyProfilePending(
  repositories: CoreRepositories,
  userId: string | null,
): Promise<boolean> {
  if (userId === null || userId === '') return false
  const docs = await repositories.find({
    collection: 'profile',
    where: { user: { equals: userId } },
    limit: 1,
  })
  const profile = docs.docs[0] as { type?: unknown; approvalStatus?: unknown } | undefined
  return profile?.type === 'company' && profile.approvalStatus === 'pending'
}

/** Ranked reveal views: valid bids amount-desc with earliest-wins ties, invalid bids greyed. */
function rankedViews(decrypted: DecryptedBid[]): RevealedBidView[] {
  const valid = decrypted
    .filter((bid) => bid.valid)
    .sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount
      return Date.parse(a.createdAt) - Date.parse(b.createdAt)
    })
  const views: RevealedBidView[] = valid.map((bid, index) => {
    const next = valid[index + 1]
    return {
      id: bid.id,
      amount: bid.amount,
      createdAt: bid.createdAt,
      valid: true,
      invalidReason: null,
      rank: index + 1,
      tie: false,
      marginToNext: next !== undefined ? bid.amount - next.amount : null,
    }
  })
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
      marginToNext: null,
    })
  }
  return views
}

/**
 * Identity view for the post-reveal record: built ONLY from the decrypted
 * sealed-bid payload after the one-shot reveal, never from live bids. The
 * code is masked server-side (D-16, last 4 visible) and the user detail
 * link is included only for roles holding users:read.
 */
function bidderIdentityView(
  bid: DecryptedBid | undefined,
  canViewUsers: boolean,
): RevealedBidderIdentity | null {
  if (bid === undefined) return null
  const rawSnapshot = bid.identitySnapshot
  if (typeof rawSnapshot !== 'string' || rawSnapshot === '') return null
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawSnapshot) as Record<string, unknown>
  } catch {
    return null
  }
  const text = (key: string): string | null => {
    const value = parsed[key]
    return typeof value === 'string' && value.trim() !== '' ? value : null
  }
  const registrikood = text('registrikood')
  const isikukood = text('isikukood')
  const code = registrikood ?? isikukood
  const userId = bid.user !== '' ? bid.user : null
  return {
    name: text('name'),
    email: text('email'),
    maskedCode: code !== null ? maskIsikukood(code) : null,
    isCompany: registrikood !== null,
    userId,
    userHref:
      canViewUsers && userId !== null ? `/admin/users/${encodeURIComponent(userId)}` : null,
  }
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
  /** Winner-modal fee estimate (3% + VAT success fee on completion); null before a ranked top bid exists. */
  feeEstimate: SealedCeremonyFeeEstimate | null
  /** Winner's company profile is pending approval — the confirm flow forces an explicit choice. */
  winnerProfileHold: boolean
  /** The viewer is the opener, a signer, or holds the configured approver role. */
  viewerIsParticipant: boolean
  /** Opening started (opener signed) and not yet concluded — other admins get a read-only view. */
  openingInProgress: boolean
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
    feeEstimate: null,
    winnerProfileHold: false,
    viewerIsParticipant: true,
    openingInProgress: false,
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
  const settingsDocs = await repositories.find({ collection: 'settings', limit: 1 })
  const settingsDoc = settingsDocs.docs[0]

  let bids: RevealedBidView[] = []
  let topMeetsReserve: boolean | null = null
  let feeEstimate: SealedCeremonyFeeEstimate | null = null
  let winnerProfileHold = false
  if (revealEntry !== null) {
    const decrypted = decryptSealedBids(await getSealedBidsForAuction(auctionId))
    // Identity is ceremony-scoped and post-reveal only: this replay runs
    // behind the sealed:read gate and after the one-shot sealed.reveal
    // entry. The users link rides along only for users:read roles.
    const canViewUsers = can(session.role, 'users:read')
    const decryptedById = new Map(decrypted.map((bid) => [bid.id, bid]))
    bids = rankedViews(decrypted).map((bid) => ({
      ...bid,
      bidder: bidderIdentityView(decryptedById.get(bid.id), canViewUsers),
    }))
    const topValid = bids.find((bid) => bid.valid)
    if (topValid && typeof auction.reservePriceCents === 'number') {
      topMeetsReserve = eurosToCents(topValid.amount) >= auction.reservePriceCents
    } else {
      topMeetsReserve = topValid !== undefined
    }
    if (topValid) {
      feeEstimate = feeEstimateFor(topValid.amount, auction, settingsDoc)
      winnerProfileHold = await companyProfilePending(
        repositories,
        topValid.bidder?.userId ?? null,
      )
    }
  }

  // "Avamine on pooleli": other admins get a read-only view while a signed
  // ceremony is under way. The configured approver role must keep signing
  // access, or the second signature could never arrive.
  const signaturesExpired =
    record !== null &&
    ((record.approver !== undefined && !signatureFresh(record.approver)) ||
      !signatureFresh(record.opener))
  const approverRole = readAuctionDefaults(settingsDoc).sealedApproverRole
  const winnerConfirmed = winnerEntry !== null
  const voided = voidEntry !== null
  const viewerIsParticipant =
    record === null ||
    record.opener.userId === session.userId ||
    record.approver?.userId === session.userId ||
    session.role === approverRole

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
    feeEstimate,
    winnerProfileHold,
    viewerIsParticipant,
    openingInProgress: record !== null && !winnerConfirmed && !voided,
    winnerConfirmed,
    voided,
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
    context: await auditRequestContext(),
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

  // The second signature must come from the role configured in Seaded
  // (Oksjonid defaults); an unset setting falls back to the superadmin.
  const settingsDocs = await repositories.find({ collection: 'settings', limit: 1 })
  const approverRole = readAuctionDefaults(settingsDocs.docs[0]).sealedApproverRole
  if (session.role !== approverRole) {
    return { ok: false, phase: 'checklist', error: `Avamise kinnitab ainult ${approverRole}.` }
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
    context: await auditRequestContext(),
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
    context: await auditRequestContext(),
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
  const companyProfileDecision = readText(formData, 'companyProfileDecision')

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
      ...(reason ? { reason } : {}),
      context: await auditRequestContext(),
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
      reason,
      context: await auditRequestContext(),
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

  // "Ettevõtte profiil ootel": the winner's company profile awaits approval,
  // so the operator must explicitly choose — proceed to the contract anyway
  // or hold the confirmation. No silent default exists.
  const companyProfileOotel = await companyProfilePending(repositories, target.user)
  if (companyProfileOotel) {
    if (companyProfileDecision !== 'proceed' && companyProfileDecision !== 'hold') {
      return {
        ok: false,
        phase: 'revealed',
        error: 'Ettevõtte profiil on ootel — vali: jätka lepinguga või hoia kinnitamine ootel.',
      }
    }
    if (companyProfileDecision === 'hold') {
      return {
        ok: false,
        phase: 'revealed',
        error: 'Kinnitamine hoitakse ootel, kuni võitja ettevõtte profiil on kinnitatud.',
      }
    }
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
      // Winner and seller learn the outcome (with the fee estimate) at the
      // confirm step — the moment the sale becomes certain.
      const settingsDocs = await repositories.find({ collection: 'settings', limit: 1 })
      const feeEstimateEur = centsToEuros(
        successFeeCents(eurosToCents(top.amount), feePercentFor(auction, settingsDocs.docs[0])),
      )
      eventBus.emit({
        type: 'auction.won',
        userId: target.user,
        payload: {
          auctionId,
          auctionTitle: auction.title,
          winningBid: top.amount,
          feeEstimateEur,
        },
      })
      if (typeof auction.sellerId === 'string' && auction.sellerId !== '') {
        eventBus.emit({
          type: 'auction.sold',
          userId: auction.sellerId,
          payload: {
            auctionId,
            auctionTitle: auction.title,
            finalPrice: top.amount,
            feeEstimateEur,
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
          ...(companyProfileOotel
            ? { companyProfileOotel: true, companyProfileDecision: 'proceed' }
            : {}),
        },
        context: await auditRequestContext(),
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
 * Empty-lot shortcut from the pre-flight checklist: a lot with zero valid
 * sealed bids is declared unsold without the two-signature ceremony
 * (single-admin rules). The server re-checks the empty state by decrypting,
 * so a lot with any qualifying bid can never bypass the ceremony.
 */
export async function markSealedUnsoldShortcutAction(
  _prev: SealedCeremonyActionState,
  formData: FormData,
): Promise<SealedCeremonyActionState> {
  const { session, repositories } = await requireAdminRepositories()
  const denied = ceremonyOperateOrError(session.role)
  if (denied) return { ok: false, phase: 'checklist', error: denied }

  const auctionId = readText(formData, 'auctionId')
  const reason = readText(formData, 'reason')
  if (reason.length < MIN_REASON_LENGTH) {
    return {
      ok: false,
      phase: 'checklist',
      error: `Müümata märkimine vajab põhjust (vähemalt ${String(MIN_REASON_LENGTH)} tähemärki).`,
    }
  }

  const auction = await repositories.findByID({ collection: 'auctions', id: auctionId })
  if (!auction) return { ok: false, phase: 'checklist', error: 'Oksjonit ei leitud.' }

  // Idempotency precedes the status gate, mirroring the void path.
  const existing = await findCeremonyAuditEntry(repositories, 'sealed.mark_unsold', auctionId)
  if (existing !== null) return { ok: true, phase: 'unsold', error: null }
  if (auction.status !== 'ended') {
    return { ok: false, phase: 'checklist', error: 'Müümata otsetee kehtib ainult lõppenud oksjonil.' }
  }

  const decrypted = decryptSealedBids(await getSealedBidsForAuction(auctionId))
  const validCount = decrypted.filter((bid) => bid.valid).length
  if (validCount > 0) {
    return {
      ok: false,
      phase: 'checklist',
      error: 'Oksjonil on kehtivaid pakkumisi — tulemus otsustakse avamistseremoonial.',
    }
  }

  try {
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
      after: { reason, shortcut: true, totalBids: decrypted.length, validCount: 0 },
      reason,
      context: await auditRequestContext(),
    })
  } catch (error) {
    return {
      ok: false,
      phase: 'checklist',
      error: `Müümata märkimine ebaõnnestus: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  revalidatePath(auctionDetailPath(auctionId))
  revalidatePath(`${auctionDetailPath(auctionId)}/ceremony`)
  return { ok: true, phase: 'unsold', error: null }
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
        reason,
        context: await auditRequestContext(),
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

// ── Bulk schedule (task 2.2, extended by 5.3) ───────────────────────────────
//
// Draft-only scheduling from the auctions list: every selected lot is
// scope-checked, then moved one immutable step (draft → scheduled) to a
// shared Tallinn wall-time start. Non-draft selections are rejected with an
// explicit list naming the offending rows (spec scenario). Task 5.3 adds
// the "nihuta kõiki lõppe ×h" shift: every row keeps its own end-time base
// (its stored endsAt, else the shared one) shifted by the same N hours, so
// the individual end-time offsets between rows survive the shift.

function shiftedEndIso(baseIso: string, shiftHours: number): string {
  return new Date(Date.parse(baseIso) + shiftHours * 60 * 60 * 1000).toISOString()
}

const MAX_SHIFT_HOURS = 8760

export async function bulkScheduleAuctionsAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  const listPath = '/admin/auctions'
  await assertPermissionOrRedirect(session.role, 'auctions:write', listPath)

  const ids = formData
    .getAll('ids')
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
    .map((entry) => entry.trim())
  if (ids.length === 0) {
    return redirectWithError(listPath, 'Vali vähemalt üks oksjon.')
  }

  const startsIso = tallinnWallTimeToUtcIso(readText(formData, 'startsAt'))
  if (startsIso === null) {
    return redirectWithError(listPath, 'Sisesta korrektne algusaeg (kellaaeg Europe/Tallinn).')
  }
  if (Date.parse(startsIso) <= Date.now()) {
    return redirectWithError(listPath, 'Algusaeg peab olema tulevikus.')
  }
  const endsRaw = readText(formData, 'endsAt')
  let endsIso: string | null = null
  if (endsRaw !== '') {
    endsIso = tallinnWallTimeToUtcIso(endsRaw)
    if (endsIso === null) {
      return redirectWithError(listPath, 'Sisesta korrektne lõppaeg (kellaaeg Europe/Tallinn).')
    }
    if (Date.parse(endsIso) <= Date.parse(startsIso)) {
      return redirectWithError(listPath, 'Lõppaeg peab olema pärast algusaega.')
    }
  }
  const shiftRaw = readText(formData, 'shiftEndHours')
  let shiftHours = 0
  if (shiftRaw !== '') {
    const parsed = Number.parseInt(shiftRaw, 10)
    if (!Number.isInteger(parsed) || parsed < -MAX_SHIFT_HOURS || parsed > MAX_SHIFT_HOURS) {
      return redirectWithError(
        listPath,
        `Nihke sisend peab olema täisarv tundides (−${String(MAX_SHIFT_HOURS)}…${String(MAX_SHIFT_HOURS)}).`,
      )
    }
    shiftHours = parsed
  }

  // Reads run unscoped so in-scope drafts of any status are visible; the
  // per-row scope check below is the authorization boundary.
  const trusted = await getRepositories()
  const scope = auctionScope(session.role, session.userId)
  const offending: string[] = []
  const schedulable: AuctionDoc[] = []
  const rowEnds = new Map<string, string | null>()
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
    let rowEnd: string | null = null
    if (endsIso !== null || shiftHours !== 0) {
      const base =
        typeof auction.endsAt === 'string' && !Number.isNaN(Date.parse(auction.endsAt))
          ? auction.endsAt
          : endsIso
      if (base !== null) {
        const shifted = shiftedEndIso(base, shiftHours)
        if (Date.parse(shifted) <= Date.parse(startsIso)) {
          offending.push(`${auction.title} (nihutatud lõpp enne algust)`)
          continue
        }
        rowEnd = shifted
      }
    }
    schedulable.push(auction)
    rowEnds.set(auction.id, rowEnd)
  }

  if (offending.length > 0) {
    return redirectWithError(
      listPath,
      `Ajastada saab ainult mustandeid. Blokeeritud read: ${offending.slice(0, 5).join('; ')}`,
    )
  }
  if (schedulable.length === 0) {
    return redirectWithError(listPath, 'Ühtegi valitud oksjonit ei saa ajastada.')
  }

  let failure: string | null = null
  try {
    for (const auction of schedulable) {
      const rowEnd = rowEnds.get(auction.id) ?? null
      await repositories.update({
        collection: 'auctions',
        id: auction.id,
        data: {
          status: 'scheduled',
          startsAt: startsIso,
          scheduledAt: startsIso,
          ...(rowEnd !== null ? { endsAt: rowEnd } : {}),
        },
      })
    }
    const endsByAuction: Record<string, string> = {}
    for (const [auctionId, rowEnd] of rowEnds) {
      if (rowEnd !== null) endsByAuction[auctionId] = rowEnd
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
        ...(shiftHours !== 0 ? { shiftHours } : {}),
        ...(Object.keys(endsByAuction).length > 0 ? { endsByAuction } : {}),
        auctionIds: schedulable.map((auction) => auction.id),
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(listPath, `Bulks ajastamine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/auctions')
  return redirectNotice(
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
      return redirectNotice(feedbackPath, 'viga', error.message)
    }
    throw error
  }

  const auctionId = readText(formData, 'auctionId')
  const bidId = readText(formData, 'bidId')
  if (!auctionId || !bidId) {
    return redirectWithError(feedbackPath, 'Pakkumuse otsustamiseks puudub identifikaator.')
  }

  const trusted = await getRepositories()
  const auction = await loadAuctionForDecision(trusted, auctionId)
  if (!auction) return redirectWithError(feedbackPath, 'Oksjonit ei leitud.')
  if (
    !auctionInScope(auctionScope(session.role, session.userId), {
      specialistId: auction.specialistId,
      sellerId: auction.sellerId,
    })
  ) {
    return redirectWithError(feedbackPath, 'Oksjon ei ole teie tööulatuses.')
  }

  const decision: ApproveDecision = await approveAlapakkumine(auctionId, bidId)
  if (decision.outcome !== 'approved') {
    if (decision.outcome === 'not_pending') {
      const earlier = await earlierDecisionMessage(trusted, bidId)
      return redirectWithError(
        feedbackPath,
        earlier ?? `Pakkumus ei ole enam kinnitamisel (hetke olek: ${decision.status}).`,
      )
    }
    return redirectWithError(feedbackPath, decisionFailure(decision.outcome, 'kinnitamine'))
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
  return redirectNotice(feedbackPath, 'teade', 'Alapakkumus kinnitatud ja juhtivaks seatud; osapooled teavitatud.')
}

export async function rejectUnderbidAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  const feedbackPath = feedbackPathFrom(formData, '/admin/bids')
  try {
    assertCan(session.role, 'underbids:decide')
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return redirectNotice(feedbackPath, 'viga', error.message)
    }
    throw error
  }

  const auctionId = readText(formData, 'auctionId')
  const bidId = readText(formData, 'bidId')
  const reason = readText(formData, 'reason')
  if (!auctionId || !bidId) {
    return redirectWithError(feedbackPath, 'Pakkumuse otsustamiseks puudub identifikaator.')
  }
  if (reason.length < MIN_REASON_LENGTH) {
    return redirectWithError(feedbackPath, reasonHint)
  }

  const trusted = await getRepositories()
  const auction = await loadAuctionForDecision(trusted, auctionId)
  if (!auction) return redirectWithError(feedbackPath, 'Oksjonit ei leitud.')
  if (
    !auctionInScope(auctionScope(session.role, session.userId), {
      specialistId: auction.specialistId,
      sellerId: auction.sellerId,
    })
  ) {
    return redirectWithError(feedbackPath, 'Oksjon ei ole teie tööulatuses.')
  }

  const decision: RejectDecision = await rejectAlapakkumine(auctionId, bidId, reason)
  if (decision.outcome !== 'rejected') {
    if (decision.outcome === 'not_pending') {
      const earlier = await earlierDecisionMessage(trusted, bidId)
      return redirectWithError(
        feedbackPath,
        earlier ?? `Pakkumus ei ole enam kinnitamisel (hetke olek: ${decision.status}).`,
      )
    }
    return redirectWithError(feedbackPath, decisionFailure(decision.outcome, 'tagasilükkamine'))
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
  return redirectNotice(feedbackPath, 'teade', 'Alapakkumus tagasi lükatud; pakkuja teavitatud põhjusega.')
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
