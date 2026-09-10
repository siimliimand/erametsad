'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'
import { can, isStaffRole, type AdminPermission } from '../_lib/permissions'
import { getMediaBucket } from '../admin/media/_lib/media-upload'
import {
  buildGdprZip,
  bytesToBase64,
  gdprJsonEntry,
  type GdprZipEntry,
} from '../admin/users/_components/gdpr-zip'
import { isSuspendDuration, suspendedUntil } from '../admin/users/_components/suspend'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { clearSessionCookiesOnStore, createSession, getUserSession, revokeSession, revokeUserSessions, sessionCookieDomainFromHost, writeSessionCookies } from '@/lib/auth/session'
import { computeIpHash } from '@/lib/bidding/place-bid'
import type { CoreRepositories, UserDoc } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import { auctionObjectTypes, userRoles } from '@/lib/data/schema'
import { db } from '@/lib/db'
import { adminUrl } from '@/lib/routing/admin-base-server'

const REASON_MIN_LENGTH = 5

// Enforcement actions are audited with the same `user.suspend` key in both
// directions; `after.status` distinguishes a suspension from an early end.
const AUDIT_SUSPEND = 'user.suspend'

// Registry key from docs/design/admin/14-audit-log.md; `after.phase` splits
// start from stop, `after.reason` carries the mandatory view reason.
const AUDIT_IMPERSONATE = 'user.impersonate'

// Spec delta (admin-people / Impersonation): a view session is clamped to a
// 30-minute expiresAt and never outlives it, even after token rotation.
const IMPERSONATION_TTL_MS = 30 * 60 * 1000

// Registry key for the superadmin leading-bid void; bids stay append-only,
// so the void is the compensating status correction (sealed.void pattern).
const AUDIT_BID_VOID = 'bid.void'

// Registry key for the permanent ban; the registration guard treats an
// existing `user.ban` entry on the isikukood-matched user as the ban marker.
const AUDIT_BAN = 'user.ban'

// Registry key for the shill flag; the users table has no flag column, so
// the durable marker is the append-only entry with `after.phase` splitting
// flagged from cleared (same marker pattern as the ban above).
const AUDIT_SHILL_FLAG = 'user.shill_flag'

// Registry keys for the GDPR tools; the delete key covers anonymize with
// retention (no row is removed, so `after.retentionUntil` carries the
// 7-year accounting retention deadline).
const AUDIT_GDPR_EXPORT = 'user.gdpr_export'
const AUDIT_GDPR_DELETE = 'user.gdpr_delete'

const GDPR_RETENTION_YEARS = 7

// Spec delta (admin-people / GDPR): a delete request observes a 14-day
// cooling-off before the hard delete, cancellable in the portal. The state
// machine rides the append-only audit entries via `after.phase`:
// requested → cancelled (portal) | executed (admin, after the window).
const GDPR_COOLING_OFF_DAYS = 14

/** Result shape for the client-invoked drawer actions (ban, GDPR tools). */
export type UserActionResult = { ok: true; message: string } | { ok: false; error: string }

function actionError(error: string): { ok: false; error: string } {
  return { ok: false, error }
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function readCheckbox(formData: FormData, key: string): boolean {
  const value = formData.get(key)
  return value === 'on' || value === 'true'
}

function hasMinReason(value: string): boolean {
  return value.length >= REASON_MIN_LENGTH
}

async function redirectWithError(path: string, message: string): Promise<never> {
  redirect(await adminUrl(`${path}?viga=${encodeURIComponent(message)}`))
}

async function redirectWithNotice(path: string, message: string): Promise<never> {
  redirect(await adminUrl(`${path}?teade=${encodeURIComponent(message)}`))
}

async function assertPermissionOrRedirect(
  role: Parameters<typeof can>[0],
  permission: AdminPermission,
  path: string,
): Promise<void> {
  if (!can(role, permission)) {
    await redirectWithError(path, 'Teil puudub õigus selle toimingu sooritamiseks.')
  }
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
    const payload = token ? verifyAccessToken(token) : null
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

/**
 * Append-only audit write. Like the other admin modules, the write runs on
 * unguarded system repositories after the admin permission check —
 * notifications cannot be created through a staff guard context at all.
 * The task-4.7 era columns (reason, sessionId, ipHash, userAgent) ride the
 * optional extras; `context` comes from auditRequestContext().
 */
async function audit(
  repositories: CoreRepositories,
  entry: {
    actorId: string
    action: string
    entityType: string
    entityId: string
    before?: unknown
    after: unknown
    reason?: string
    context?: {
      sessionId: string | null
      ipHash: string | null
      userAgent: string | null
    }
  },
): Promise<void> {
  const context = entry.context
  await repositories.create({
    collection: 'audit-entry',
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      ...(entry.before !== undefined ? { before: entry.before } : {}),
      after: entry.after,
      ...(entry.reason ? { reason: entry.reason } : {}),
      ...(context?.sessionId ? { sessionId: context.sessionId } : {}),
      ...(context?.ipHash ? { ipHash: context.ipHash } : {}),
      ...(context?.userAgent ? { userAgent: context.userAgent } : {}),
    },
  })
}

async function notifyUser(
  repositories: CoreRepositories,
  input: { userId: string; event: string; title: string; body: string; payload?: Record<string, unknown> },
): Promise<void> {
  await repositories.create({
    collection: 'notifications',
    data: {
      userId: input.userId,
      event: input.event,
      channel: 'in_app',
      title: input.title,
      body: input.body,
      ...(input.payload ? { payload: input.payload } : {}),
      sentAt: new Date().toISOString(),
    },
  })
}

interface AuditLikeEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  after?: unknown
  createdAt: string
}

function auditPayload(after: unknown): Record<string, unknown> {
  if (typeof after === 'string' && after !== '') {
    try {
      const parsed: unknown = JSON.parse(after)
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  return typeof after === 'object' && after !== null ? (after as Record<string, unknown>) : {}
}

async function findUserAuditEntries(
  repositories: CoreRepositories,
  userId: string,
  action: string,
): Promise<AuditLikeEntry[]> {
  const result = await repositories.find({
    collection: 'audit-entry',
    where: {
      and: [
        { entityType: { equals: 'user' } },
        { entityId: { equals: userId } },
        { action: { equals: action } },
      ],
    },
    sort: '-createdAt',
    pagination: false,
  })
  return result.docs as unknown as AuditLikeEntry[]
}

/** GDPR delete state machine, read from the latest `user.gdpr_delete` entry. */
export interface GdprDeleteStatus {
  phase: 'none' | 'requested' | 'cancelled' | 'executed'
  requestedAt: string | null
  coolingOffUntil: string | null
  /** True when a pending request's 14-day window has fully elapsed. */
  coolingOffElapsed: boolean
}

async function readDeleteStatus(repositories: CoreRepositories, userId: string): Promise<GdprDeleteStatus> {
  const entries = await findUserAuditEntries(repositories, userId, AUDIT_GDPR_DELETE)
  const latest = entries[0]
  if (!latest) {
    return { phase: 'none', requestedAt: null, coolingOffUntil: null, coolingOffElapsed: false }
  }
  const payload = auditPayload(latest.after)
  const phase = payload.phase
  // Entries from before the cooling-off flow carry no phase: they mark a
  // completed anonymization.
  if (phase !== 'requested' && phase !== 'cancelled' && phase !== 'executed') {
    return { phase: 'executed', requestedAt: null, coolingOffUntil: null, coolingOffElapsed: false }
  }
  const coolingOffUntil = typeof payload.coolingOffUntil === 'string' ? payload.coolingOffUntil : null
  const elapsed =
    phase === 'requested' && coolingOffUntil !== null
      ? Date.now() >= new Date(coolingOffUntil).getTime()
      : false
  return {
    phase,
    requestedAt: latest.createdAt,
    coolingOffUntil,
    coolingOffElapsed: elapsed,
  }
}

/** Pre-check report rows: references only, amounts stay untouched. */
export interface GdprDeletePrecheck {
  activeAuctionBids: {
    bidId: string
    auctionId: string
    auctionTitle: string | null
    amountCents: number
    status: string
  }[]
  openContracts: { contractId: string; status: string; createdAt: string }[]
  /** Sealed bids never opened in a ceremony; the delete purges these rows. */
  unopenedSealedBidCount: number
  signedContractCount: number
  retentionYears: number
  blocking: boolean
}

function addDays(base: Date, days: number): Date {
  const copy = new Date(base)
  copy.setDate(copy.getDate() + days)
  return copy
}

async function buildDeletePrecheck(
  repositories: CoreRepositories,
  userId: string,
): Promise<GdprDeletePrecheck> {
  const [{ docs: bids }, { docs: contracts }] = await Promise.all([
    repositories.find({ collection: 'bids', where: { user: { equals: userId } }, pagination: false }),
    repositories.find({
      collection: 'contracts',
      where: { signedBy: { equals: userId } },
      pagination: false,
    }),
  ])

  const auctionIds = [...new Set(bids.map((bid) => bid.auctionId))]
  const auctions =
    auctionIds.length > 0
      ? (
          await repositories.find({
            collection: 'auctions',
            where: { id: { in: auctionIds } },
            pagination: false,
          })
        ).docs
      : []
  const auctionsById = new Map(auctions.map((auction) => [auction.id, auction]))

  const activeAuctionBids = bids
    .filter((bid) => auctionsById.get(bid.auctionId)?.status === 'active')
    .map((bid) => {
      const auction = auctionsById.get(bid.auctionId)
      return {
        bidId: bid.id,
        auctionId: bid.auctionId,
        auctionTitle: typeof auction?.title === 'string' ? auction.title : null,
        amountCents: bid.amountCents,
        status: bid.status,
      }
    })

  const openContracts = contracts
    .filter((contract) => contract.status === 'prepared' || contract.status === 'sent')
    .map((contract) => ({
      contractId: contract.id,
      status: contract.status,
      createdAt: contract.createdAt,
    }))

  const sealedAuctionIds = [
    ...new Set(bids.filter((bid) => bid.type === 'sealed').map((bid) => bid.auctionId)),
  ]
  const revealedAuctionIds = new Set(
    sealedAuctionIds.length > 0
      ? (
          await repositories.find({
            collection: 'audit-entry',
            where: {
              and: [
                { entityType: { equals: 'auction' } },
                { action: { equals: 'sealed.reveal' } },
                { entityId: { in: sealedAuctionIds } },
              ],
            },
            pagination: false,
          })
        ).docs.map((entry) => entry.entityId)
      : [],
  )
  const unopenedSealedBidCount = bids.filter(
    (bid) => bid.type === 'sealed' && !revealedAuctionIds.has(bid.auctionId),
  ).length

  const signedContractCount = contracts.filter((contract) => contract.status === 'signed').length

  return {
    activeAuctionBids,
    openContracts,
    unopenedSealedBidCount,
    signedContractCount,
    retentionYears: GDPR_RETENTION_YEARS,
    blocking: activeAuctionBids.length > 0 || openContracts.length > 0,
  }
}

export async function updateUserAction(formData: FormData): Promise<void> {
  const { session } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) return redirectWithError('/admin/users', 'Kasutaja identifikaator puudub.')

  const editPath = `/admin/users/${id}`
  await assertPermissionOrRedirect(session.role, 'users:write', editPath)
  const repositories = await getRepositories()

  const role = readText(formData, 'role')
  if (!userRoles.includes(role as (typeof userRoles)[number]) || role === 'guest') {
    return redirectWithError(editPath, 'Vali sobiv roll.')
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'users',
      id,
      data: {
        role,
        name: readText(formData, 'name') || null,
        phone: readText(formData, 'phone') || null,
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(editPath, `Kasutaja salvestamine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/users')
  revalidatePath(editPath)
  return redirectWithNotice(editPath, 'Kasutaja andmed salvestatud.')
}

export async function grantAuctionRightAction(formData: FormData): Promise<void> {
  const { session } = await requireAdminRepositories()

  const userId = readText(formData, 'userId')
  const objectType = readText(formData, 'objectType')
  const reason = readText(formData, 'reason')
  const notify = readCheckbox(formData, 'notify')
  const editPath = `/admin/users/${userId}`

  if (!userId) return redirectWithError('/admin/users', 'Kasutaja identifikaator puudub.')
  await assertPermissionOrRedirect(session.role, 'users:write', editPath)
  if (!auctionObjectTypes.includes(objectType as (typeof auctionObjectTypes)[number])) {
    return redirectWithError(editPath, 'Vali sobiv objekti tüüp.')
  }
  if (!hasMinReason(reason)) {
    return redirectWithError(editPath, 'Õiguse andmise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const repositories = await getRepositories()

  const user = await repositories.findByID({ collection: 'users', id: userId })
  if (!user) return redirectWithError('/admin/users', 'Kasutajat ei leitud.')

  const existing = await repositories.find({
    collection: 'auction-rights',
    where: {
      and: [
        { user: { equals: userId } },
        { objectType: { equals: objectType } },
        { revokedAt: { exists: false } },
      ],
    },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    return redirectWithError(editPath, 'See oksjoniõigus on juba antud.')
  }

  let failure: string | null = null
  const grantedAt = new Date().toISOString()
  try {
    await repositories.create({
      collection: 'auction-rights',
      data: {
        user: userId,
        objectType,
        grantedBy: session.userId,
        grantedAt,
      },
    })

    await audit(repositories, {
      actorId: session.userId,
      action: 'user.right_grant',
      entityType: 'user',
      entityId: userId,
      after: { objectType, grantedAt, reason, notified: notify },
      reason,
      context: await auditRequestContext(),
    })

    if (notify) {
      await notifyUser(repositories, {
        userId,
        event: 'user.right_grant',
        title: 'Uus pakkumisõigus',
        body: `Administrator andis teile pakkumisõiguse. Põhjus: ${reason}`,
        payload: { objectType, reason },
      })
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(editPath, `Oksjoniõiguse andmine ebaõnnestus: ${failure}`)
  }

  revalidatePath(editPath)
  return redirectWithNotice(editPath, `Õigus antud${notify ? ' ja kasutajat teavitatud' : ''}.`)
}

export async function revokeAuctionRightAction(formData: FormData): Promise<void> {
  const { session } = await requireAdminRepositories()

  const rightId = readText(formData, 'rightId')
  const userId = readText(formData, 'userId')
  const reason = readText(formData, 'reason')
  const notify = readCheckbox(formData, 'notify')
  const editPath = `/admin/users/${userId}`

  if (!rightId || !userId) {
    return redirectWithError('/admin/users', 'Oksjoniõiguse identifikaator puudub.')
  }
  await assertPermissionOrRedirect(session.role, 'users:write', editPath)
  if (!hasMinReason(reason)) {
    return redirectWithError(editPath, 'Õiguse tühistamise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const repositories = await getRepositories()

  const right = await repositories.findByID({ collection: 'auction-rights', id: rightId })
  if (right?.userId !== userId) {
    return redirectWithError(editPath, 'Oksjoniõigust ei leitud või see ei kuulu sellele kasutajale.')
  }
  if (right.revokedAt !== null) {
    return redirectWithError(editPath, 'See oksjoniõigus on juba tühistatud.')
  }

  let failure: string | null = null
  const revokedAt = new Date().toISOString()
  try {
    await repositories.update({
      collection: 'auction-rights',
      id: rightId,
      data: { revokedAt },
    })

    await audit(repositories, {
      actorId: session.userId,
      action: 'user.right_revoke',
      entityType: 'user',
      entityId: userId,
      before: { objectType: right.objectType, revokedAt: null },
      after: { objectType: right.objectType, revokedAt, reason, notified: notify },
      reason,
      context: await auditRequestContext(),
    })

    if (notify) {
      await notifyUser(repositories, {
        userId,
        event: 'user.right_revoke',
        title: 'Pakkumisõigus tühistatud',
        body: `Administraator tühistas teie pakkumisõiguse. Põhjus: ${reason}`,
        payload: { objectType: right.objectType, reason },
      })
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(editPath, `Oksjoniõiguse tühistamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(editPath)
  return redirectWithNotice(editPath, `Õigus tühistatud${notify ? ' ja kasutajat teavitatud' : ''}.`)
}

export async function suspendUserAction(formData: FormData): Promise<void> {
  const { session } = await requireAdminRepositories()

  const userId = readText(formData, 'userId')
  const duration = readText(formData, 'duration')
  const reason = readText(formData, 'reason')
  const editPath = `/admin/users/${userId}`

  if (!userId) return redirectWithError('/admin/users', 'Kasutaja identifikaator puudub.')
  await assertPermissionOrRedirect(session.role, 'users:write', editPath)
  if (!isSuspendDuration(duration)) {
    return redirectWithError(editPath, 'Vali peatamise kestus.')
  }
  if (!hasMinReason(reason)) {
    return redirectWithError(editPath, 'Peatamise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const repositories = await getRepositories()

  const user = await repositories.findByID({ collection: 'users', id: userId })
  if (!user) return redirectWithError('/admin/users', 'Kasutajat ei leitud.')
  if (user.status === 'suspended') {
    return redirectWithError(editPath, 'Kasutaja konto on juba peatatud.')
  }

  const activeAutobidders = await repositories.find({
    collection: 'autobidders',
    where: {
      and: [{ user: { equals: userId } }, { status: { equals: 'active' } }],
    },
    pagination: false,
  })

  const until = suspendedUntil(duration)

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'users',
      id: userId,
      data: { status: 'suspended' },
    })

    for (const autobidder of activeAutobidders.docs) {
      await repositories.update({
        collection: 'autobidders',
        id: autobidder.id,
        data: { status: 'paused' },
      })
    }

    await audit(repositories, {
      actorId: session.userId,
      action: AUDIT_SUSPEND,
      entityType: 'user',
      entityId: userId,
      before: { status: user.status, activeAutobidders: activeAutobidders.docs.length },
      after: {
        status: 'suspended',
        duration,
        suspendedUntil: until,
        reason,
        autobiddersCancelled: activeAutobidders.docs.length,
      },
      reason,
      context: await auditRequestContext(),
    })

    await notifyUser(repositories, {
      userId,
      event: AUDIT_SUSPEND,
      title: 'Teie konto on peatatud',
      body: `Teie konto on peatatud. Kestus: ${
        duration === 'indefinite' ? 'tähtajatu' : duration === '24h' ? '24 tundi' : '7 päeva'
      }. Põhjus: ${reason}. Aktiivsed automaatpakkujad on deaktiveeritud.`,
      payload: { duration, suspendedUntil: until, reason },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(editPath, `Kasutaja peatamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(editPath)
  revalidatePath('/admin/users')
  return redirectWithNotice(editPath, 'Konto peatatud; aktiivsed automaatpakkujad deaktiveeritud ja kasutaja teavitatud.')
}

export async function resumeUserAction(formData: FormData): Promise<void> {
  const { session } = await requireAdminRepositories()

  const userId = readText(formData, 'userId')
  const reason = readText(formData, 'reason')
  const editPath = `/admin/users/${userId}`

  if (!userId) return redirectWithError('/admin/users', 'Kasutaja identifikaator puudub.')
  await assertPermissionOrRedirect(session.role, 'users:write', editPath)
  if (!hasMinReason(reason)) {
    return redirectWithError(editPath, 'Aktiveerimise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const repositories = await getRepositories()

  const user = await repositories.findByID({ collection: 'users', id: userId })
  if (!user) return redirectWithError('/admin/users', 'Kasutajat ei leitud.')
  if (user.status !== 'suspended') {
    return redirectWithError(editPath, 'Kasutaja konto ei ole peatatud.')
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'users',
      id: userId,
      data: { status: 'active' },
    })

    await audit(repositories, {
      actorId: session.userId,
      action: AUDIT_SUSPEND,
      entityType: 'user',
      entityId: userId,
      before: { status: 'suspended' },
      after: { status: 'active', resumed: true, reason },
      reason,
      context: await auditRequestContext(),
    })

    await notifyUser(repositories, {
      userId,
      event: AUDIT_SUSPEND,
      title: 'Teie konto on uuesti aktiivne',
      body: 'Teie konto peatus on lõpetatud ja konto on uuesti aktiivne.',
      payload: { resumed: true },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(editPath, `Kasutaja aktiveerimine ebaõnnestus: ${failure}`)
  }

  revalidatePath(editPath)
  revalidatePath('/admin/users')
  return redirectWithNotice(editPath, 'Konto aktiveeritud uuesti ja kasutajat teavitatud.')
}

export async function revealIsikukoodAction(
  userId: string,
): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  const { session, repositories } = await requireAdminRepositories()

  if (!can(session.role, 'users:read')) {
    return { ok: false, error: 'Teil puudub õigus selle toimingu sooritamiseks.' }
  }

  let user: UserDoc | null = null
  try {
    user = await repositories.findByID({ collection: 'users', id: userId })
  } catch {
    return { ok: false, error: 'Kasutajat ei õnnestu laadida.' }
  }
  if (!user) {
    return { ok: false, error: 'Kasutajat ei leitud.' }
  }
  const value = user.isikukood
  if (!value) {
    return { ok: false, error: 'Isikukood puudub.' }
  }

  // D5: the audit entry is written BEFORE the plaintext leaves this action;
  // a failed audit write means the value is not revealed at all.
  try {
    await audit(repositories, {
      actorId: session.userId,
      action: 'user.identity_view',
      entityType: 'user',
      entityId: user.id,
      after: { field: 'isikukood' },
      context: await auditRequestContext(),
    })
  } catch {
    return { ok: false, error: 'Paljastamise logimine ebaõnnestus; väärtust ei näidatud.' }
  }

  return { ok: true, value }
}

export async function revokeUserSessionAction(formData: FormData): Promise<void> {
  await requireAdminRepositories()

  const userId = readText(formData, 'userId')
  const sessionId = readText(formData, 'sessionId')
  const editPath = `/admin/users/${userId}`

  if (!userId || !sessionId) {
    return redirectWithError('/admin/users', 'Sessiooni identifikaator puudub.')
  }

  const record = await getUserSession(sessionId)
  if (record?.userId !== userId) {
    return redirectWithError(editPath, 'Sessiooni ei leitud või see ei kuulu sellele kasutajale.')
  }

  let failure: string | null = null
  try {
    await revokeSession(sessionId)
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(editPath, `Sessiooni tühistamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(editPath)
  redirect(await adminUrl(editPath))
}

/**
 * Start an admin impersonation ("vaate seanss") session for a non-staff
 * user. The view session replaces the browser's cookies: it authenticates
 * as the target user with `impersonatedBy` bound to the operator in both
 * the JWT claims and the D1 session row (so rotation cannot shed it), and
 * the guard layer fails every portal write closed for it.
 */
export async function startImpersonationAction(formData: FormData): Promise<void> {
  const { session } = await requireAdminRepositories()

  const userId = readText(formData, 'userId')
  const reason = readText(formData, 'reason')
  const editPath = `/admin/users/${userId}`

  if (!userId) return redirectWithError('/admin/users', 'Kasutaja identifikaator puudub.')
  await assertPermissionOrRedirect(session.role, 'users:write', editPath)
  if (!hasMinReason(reason)) {
    return redirectWithError(editPath, 'Vaatluse alustamise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const repositories = await getRepositories()

  const user = await repositories.findByID({ collection: 'users', id: userId })
  if (!user) return redirectWithError('/admin/users', 'Kasutajat ei leitud.')
  // Staff targets would chain administrative access through the view
  // session, so impersonation stays limited to portal roles.
  if (isStaffRole(user.role)) {
    return redirectWithError(editPath, 'Töötaja konto vaatlemine ei ole lubatud.')
  }
  if (user.status !== 'active') {
    return redirectWithError(editPath, 'Kasutaja konto ei ole aktiivne.')
  }

  const { accessToken, refreshToken, sessionId } = await createSession(
    user.id,
    user.role,
    undefined,
    session.userId,
  )

  // 30-minute TTL (spec delta admin-people): the view session row's
  // expiresAt is clamped right after creation, so the D1 liveness check ends
  // impersonation even when the 7-day session TTL would still be running.
  // The guard clause only ever touches a row that really is a view session.
  const expiresAt = new Date(Date.now() + IMPERSONATION_TTL_MS).toISOString()
  let failure: string | null = null
  try {
    const clamped = await db.query(
      `UPDATE sessions SET expires_at = ?, updated_at = ? WHERE id = ? AND impersonated_by IS NOT NULL`,
      [expiresAt, new Date().toISOString(), sessionId],
    )
    if (typeof clamped.meta.changes === 'number' && clamped.meta.changes !== 1) {
      throw new Error('vaate seansi rida ei leitud')
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(editPath, `Vaatluse ajalimiidi seadmine ebaõnnestus: ${failure}`)
  }

  // Fail closed: the browser's cookies only move once the start is on the
  // append-only audit trail.
  try {
    await audit(repositories, {
      actorId: session.userId,
      action: AUDIT_IMPERSONATE,
      entityType: 'user',
      entityId: user.id,
      after: { phase: 'start', reason, sessionId, expiresAt, ttlMinutes: 30 },
      reason,
      context: await auditRequestContext(),
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(editPath, `Vaatluse alustamise logimine ebaõnnestus: ${failure}`)
  }

  const host = (await headers()).get('host')
  writeSessionCookies(await cookies(), accessToken, refreshToken, sessionCookieDomainFromHost(host))

  revalidatePath(editPath)
  redirect(await adminUrl('/user'))
}

/**
 * End the current impersonation session. Runs inside the view session (the
 * portal banner's LÕPETA VAATLUS control), so the caller's authority comes
 * from the verified `impersonatedBy` claim cross-checked against the D1
 * session row — never from the request body. A caller without an active
 * view session gets a no-op redirect and keeps its cookies.
 */
export async function stopImpersonationAction(): Promise<void> {
  const token = (await cookies()).get('access_token')?.value
  const payload = token ? verifyAccessToken(token) : null
  const operatorId = payload?.impersonatedBy
  const sessionId = payload?.sessionId

  if (!payload || !operatorId || !sessionId) redirect('/')

  const record = await getUserSession(sessionId)
  if (record === null) redirect('/')
  if (record.impersonatedBy !== operatorId || record.userId !== payload.userId) {
    redirect(await adminUrl('/'))
  }

  const repositories = await getRepositories()

  // TTL enforcement (spec delta admin-people): rotation re-signs the row's
  // expiresAt, so elapsed time is measured from the stable createdAt. A view
  // session past the 30-minute mark is explicitly ended instead of silently
  // riding a rotated expiry.
  const expired = Date.now() - record.createdAt.getTime() >= IMPERSONATION_TTL_MS

  // The stop is audited against the real operator, but it must always win:
  // if the audit write fails the session is still revoked (the start entry
  // already carries the binding, so no revocation goes unexplained).
  try {
    await audit(repositories, {
      actorId: operatorId,
      action: AUDIT_IMPERSONATE,
      entityType: 'user',
      entityId: payload.userId,
      after: {
        phase: 'stop',
        reason: null,
        sessionId,
        ...(expired ? { expired: true } : {}),
      },
      context: await auditRequestContext(),
    })
  } catch {
    // Availability of the stop path takes precedence over the stop entry.
  }

  await revokeSession(sessionId)

  // Hand the operator a fresh session with their own role; the original
  // admin session row was never stored in the browser, so nothing needs
  // restoring from client-side state.
  const operator = await repositories.findByID({ collection: 'users', id: operatorId })
  if (operator && isStaffRole(operator.role) && operator.status === 'active') {
    const restored = await createSession(operator.id, operator.role)
    writeSessionCookies(
      await cookies(),
      restored.accessToken,
      restored.refreshToken,
      sessionCookieDomainFromHost((await headers()).get('host')),
    )
    return redirectWithNotice(
      `/admin/users/${payload.userId}`,
      expired ? 'Vaatlus aegus (30 minutit).' : 'Vaatlus lõpetatud.',
    )
  }

  clearSessionCookiesOnStore(await cookies())
  redirect(await adminUrl('/login'))
}

/**
 * Expiry feed for the portal view-session banner countdown. Reads the D1
 * row directly because SessionRecord does not carry expiresAt; only a live
 * impersonation row yields an expiry.
 */
export async function impersonationStateAction(): Promise<{
  active: boolean
  expiresAt: string | null
}> {
  const token = (await cookies()).get('access_token')?.value
  const payload = token ? verifyAccessToken(token) : null
  if (!payload?.sessionId) return { active: false, expiresAt: null }

  const rows = await db.query<{
    expires_at: string
    impersonated_by: string | null
    revoked_at: string | null
  }>(`SELECT expires_at, impersonated_by, revoked_at FROM sessions WHERE id = ?`, [
    payload.sessionId,
  ])
  const row = rows.results[0]
  if (!row) return { active: false, expiresAt: null }
  if (
    row.revoked_at !== null ||
    row.impersonated_by === null ||
    row.expires_at <= new Date().toISOString()
  ) {
    return { active: false, expiresAt: null }
  }
  return { active: true, expiresAt: row.expires_at }
}

/**
 * Permanently ban a portal user (demo 06-users "Keela kasutaja (Ban)").
 * The users table has no dedicated status column, so the durable ban marker
 * is the append-only `user.ban` audit entry: the registration guard reads it
 * back by isikukood hash, and a second ban attempt fails on its existence.
 * Account state reuses the suspend machinery (suspended status, paused
 * autobidders, revoked sessions).
 */
export async function banUserAction(userId: string, reason: string): Promise<UserActionResult> {
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'users:write')) {
    return actionError('Teil puudub õigus selle toimingu sooritamiseks.')
  }
  if (!userId) return actionError('Kasutaja identifikaator puudub.')
  if (!hasMinReason(reason)) {
    return actionError('Keelamise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const repositories = await getRepositories()

  const user = await repositories.findByID({ collection: 'users', id: userId })
  if (!user) return actionError('Kasutajat ei leitud.')
  if (isStaffRole(user.role)) {
    return actionError('Töötaja konto keelamine ei ole lubatud.')
  }

  const existingBan = await repositories.find({
    collection: 'audit-entry',
    where: {
      and: [
        { entityType: { equals: 'user' } },
        { entityId: { equals: userId } },
        { action: { equals: AUDIT_BAN } },
      ],
    },
    limit: 1,
  })
  if (existingBan.docs.length > 0) {
    return actionError('Kasutaja konto on juba keelatud.')
  }

  const activeAutobidders = await repositories.find({
    collection: 'autobidders',
    where: {
      and: [{ user: { equals: userId } }, { status: { equals: 'active' } }],
    },
    pagination: false,
  })

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'users',
      id: userId,
      data: { status: 'suspended' },
    })

    for (const autobidder of activeAutobidders.docs) {
      await repositories.update({
        collection: 'autobidders',
        id: autobidder.id,
        data: { status: 'paused' },
      })
    }

    await revokeUserSessions(userId)

    await audit(repositories, {
      actorId: session.userId,
      action: AUDIT_BAN,
      entityType: 'user',
      entityId: userId,
      before: { status: user.status, activeAutobidders: activeAutobidders.docs.length },
      after: {
        status: 'suspended',
        banned: true,
        reason,
        autobiddersCancelled: activeAutobidders.docs.length,
        registrationBlocked: true,
      },
      reason,
      context: await auditRequestContext(),
    })

    await notifyUser(repositories, {
      userId,
      event: AUDIT_BAN,
      title: 'Teie konto on keelatud',
      body: `Teie konto on keelatud ja uute kontode loomine sama isikukoodiga on blokeeritud. Põhjus: ${reason}`,
      payload: { reason },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return actionError(`Kasutaja keelamine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { ok: true, message: 'Konto keelatud; sama isikukoodiga registreerimine on blokeeritud.' }
}

/** Latest `user.shill_flag` phase for a user, or null when never flagged. */
async function latestShillFlagPhase(
  repositories: CoreRepositories,
  userId: string,
): Promise<'flagged' | 'cleared' | null> {
  const { docs } = await repositories.find({
    collection: 'audit-entry',
    where: {
      and: [
        { entityType: { equals: 'user' } },
        { entityId: { equals: userId } },
        { action: { equals: AUDIT_SHILL_FLAG } },
      ],
    },
    sort: '-createdAt',
    limit: 1,
  })
  const latest = docs[0]
  if (!latest) return null
  return auditPayload(latest.after).phase === 'cleared' ? 'cleared' : 'flagged'
}

/**
 * Flag a portal user for shill investigation (spec delta admin-people).
 * The mandatory reason lands on the append-only `user.shill_flag` audit
 * entry; there is deliberately no user notification — the flag is an
 * internal investigation marker.
 */
export async function flagUserForShillAction(
  userId: string,
  reason: string,
): Promise<UserActionResult> {
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'users:write')) {
    return actionError('Teil puudub õigus selle toimingu sooritamiseks.')
  }
  if (!userId) return actionError('Kasutaja identifikaator puudub.')
  if (!hasMinReason(reason)) {
    return actionError('Märkimise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const repositories = await getRepositories()

  const user = await repositories.findByID({ collection: 'users', id: userId })
  if (!user) return actionError('Kasutajat ei leitud.')
  if (isStaffRole(user.role)) {
    return actionError('Töötaja konto märkimine ei ole lubatud.')
  }
  if ((await latestShillFlagPhase(repositories, userId)) === 'flagged') {
    return actionError('Kasutaja on juba märgitud shill-uurimiseks.')
  }

  let failure: string | null = null
  try {
    await audit(repositories, {
      actorId: session.userId,
      action: AUDIT_SHILL_FLAG,
      entityType: 'user',
      entityId: userId,
      after: { phase: 'flagged', reason },
      reason,
      context: await auditRequestContext(),
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return actionError(`Märkimine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { ok: true, message: 'Kasutaja märgitud shill-uurimiseks.' }
}

/** Remove an active shill flag; the clear is a phase entry on the same key. */
export async function unflagUserForShillAction(
  userId: string,
  reason: string,
): Promise<UserActionResult> {
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'users:write')) {
    return actionError('Teil puudub õigus selle toimingu sooritamiseks.')
  }
  if (!userId) return actionError('Kasutaja identifikaator puudub.')
  if (!hasMinReason(reason)) {
    return actionError('Märkimise eemaldamise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const repositories = await getRepositories()

  const user = await repositories.findByID({ collection: 'users', id: userId })
  if (!user) return actionError('Kasutajat ei leitud.')
  if ((await latestShillFlagPhase(repositories, userId)) !== 'flagged') {
    return actionError('Aktiivset märget ei leitud.')
  }

  let failure: string | null = null
  try {
    await audit(repositories, {
      actorId: session.userId,
      action: AUDIT_SHILL_FLAG,
      entityType: 'user',
      entityId: userId,
      after: { phase: 'cleared', reason },
      reason,
      context: await auditRequestContext(),
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return actionError(`Märke eemaldamine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { ok: true, message: 'Märge eemaldatud.' }
}

/**
 * GDPR export (demo 06-users GDPR tab): profile, bids, contracts, rights,
 * notifications, consent log, signed contract documents and audit marks
 * collected into a ZIP. Both GDPR actions take a mandatory typed reason
 * (spec delta admin-people); the double confirm is the drawer's two-step
 * dialog. The plaintext isikukood travels inside the ZIP only (the
 * operator's own download); it never reaches the audit payload or logs.
 * The archive is also stored in R2 (media bucket pattern) for retention;
 * a missing binding in local dev degrades to download-only.
 */
export async function exportUserGdprAction(
  userId: string,
  reason: string,
): Promise<{ ok: true; filename: string; base64: string } | { ok: false; error: string }> {
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'users:read')) {
    return actionError('Teil puudub õigus selle toimingu sooritamiseks.')
  }
  if (!userId) return actionError('Kasutaja identifikaator puudub.')
  if (!hasMinReason(reason)) {
    return actionError('Eksportimise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const repositories = await getRepositories()

  const user = await repositories.findByID({ collection: 'users', id: userId })
  if (!user) return actionError('Kasutajat ei leitud.')

  const [profiles, bids, contracts, rights, notifications, auditEntries] = await Promise.all([
    repositories.find({ collection: 'profile', where: { user: { equals: userId } }, pagination: false }),
    repositories.find({ collection: 'bids', where: { user: { equals: userId } }, pagination: false }),
    repositories.find({ collection: 'contracts', where: { signedBy: { equals: userId } }, pagination: false }),
    repositories.find({ collection: 'auction-rights', where: { user: { equals: userId } }, pagination: false }),
    repositories.find({ collection: 'notifications', where: { user: { equals: userId } }, pagination: false }),
    repositories.find({
      collection: 'audit-entry',
      where: {
        and: [{ entityType: { equals: 'user' } }, { entityId: { equals: userId } }],
      },
      sort: '-createdAt',
      pagination: false,
    }),
  ])

  // The consent log carries no user column; the data subject's entries are
  // resolved through the salted IP hashes recorded on their own bids.
  const bidIpHashes = [
    ...new Set(
      bids.docs
        .map((bid) => bid.ipHash)
        .filter((ipHash): ipHash is string => typeof ipHash === 'string' && ipHash !== ''),
    ),
  ]
  const consents =
    bidIpHashes.length > 0
      ? (
          await repositories.find({
            collection: 'consent-log',
            where: { ipHash: { in: bidIpHashes } },
            sort: '-createdAt',
            pagination: false,
          })
        ).docs
      : []

  // Signed contracts are stored as rendered HTML in D1 (no PDF blobs), so
  // the archive carries each signed document in its stored form.
  const signedContractDocs = contracts.docs.filter(
    (contract): contract is (typeof contracts.docs)[number] & { renderedHtml: string } =>
      contract.status === 'signed' &&
      typeof contract.renderedHtml === 'string' &&
      contract.renderedHtml !== '',
  )

  // Explicit projection: credential columns never leave the server and the
  // decrypted isikukood is included once, as the data subject's own copy.
  const userExport = {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    status: user.status,
    authMethod: user.authMethod,
    isikukood: user.isikukood ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }

  const entries: GdprZipEntry[] = [
    gdprJsonEntry('kasutaja.json', userExport),
    gdprJsonEntry('profiilid.json', profiles.docs),
    gdprJsonEntry('pakkumised.json', bids.docs),
    gdprJsonEntry('lepingud.json', contracts.docs),
    gdprJsonEntry('oigused.json', rights.docs),
    gdprJsonEntry('teavitused.json', notifications.docs),
    gdprJsonEntry('nõusolekud.json', consents),
    gdprJsonEntry('audit.json', auditEntries.docs),
    ...signedContractDocs.map((contract) => ({
      name: `leping-${contract.id}.html`,
      data: new TextEncoder().encode(contract.renderedHtml),
    })),
  ]
  const zipBytes = buildGdprZip(entries)
  const filename = `isikuandmed-${user.id}.zip`

  // R2 archive copy follows the media bucket pattern; absence of the binding
  // (local dev) degrades to download-only instead of failing the export.
  let r2Key: string | null = null
  let archived = false
  try {
    const bucket = await getMediaBucket()
    if (bucket) {
      r2Key = `gdpr-exports/${user.id}/${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
      const copy = new ArrayBuffer(zipBytes.byteLength)
      new Uint8Array(copy).set(zipBytes)
      await bucket.put(r2Key, copy, {
        httpMetadata: { contentType: 'application/zip' },
      })
      archived = true
    }
  } catch {
    archived = false
  }

  let failure: string | null = null
  try {
    await audit(repositories, {
      actorId: session.userId,
      action: AUDIT_GDPR_EXPORT,
      entityType: 'user',
      entityId: user.id,
      after: {
        format: 'zip',
        files: entries.map((entry) => entry.name),
        bytes: zipBytes.length,
        ...(r2Key ? { r2Key } : {}),
        archived,
      },
      reason,
      context: await auditRequestContext(),
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return actionError(`Eksportimise logimine ebaõnnestus: ${failure}`)
  }

  return { ok: true, filename, base64: bytesToBase64(zipBytes) }
}

/**
 * GDPR delete with a 14-day cooling-off (spec delta admin-people). The first
 * call records the request (`after.phase: 'requested'`) and notifies the
 * user, who can cancel it in the portal during the window. A call after the
 * window executes the hard delete: the users row survives so contract and
 * billing references stay intact for the 7-year accounting retention, every
 * personal field is removed or masked, bid and contract rows are
 * pseudonymised (identity columns only — amounts are never rewritten), and
 * unopened sealed bids are purged. Blockers from the pre-check report
 * (bids on active auctions, contracts awaiting signature) require the
 * explicit `override` flag, which the audit entry records.
 */
export async function anonymizeUserAction(
  userId: string,
  reason: string,
  options?: { override?: boolean },
): Promise<UserActionResult> {
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'users:write')) {
    return actionError('Teil puudub õigus selle toimingu sooritamiseks.')
  }
  if (!userId) return actionError('Kasutaja identifikaator puudub.')
  if (!hasMinReason(reason)) {
    return actionError('Anonüümiseerimise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const repositories = await getRepositories()

  const user = await repositories.findByID({ collection: 'users', id: userId })
  if (!user) return actionError('Kasutajat ei leitud.')
  // Anonymizing a staff account would erase audit-chain actor identities.
  if (isStaffRole(user.role)) {
    return actionError('Töötaja konto anonüümiseerimine ei ole lubatud.')
  }

  const status = await readDeleteStatus(repositories, userId)
  if (status.phase === 'executed') {
    return actionError('Kasutaja konto on juba anonüümiseeritud.')
  }
  if (status.phase === 'requested') {
    if (status.coolingOffUntil !== null && !status.coolingOffElapsed) {
      return actionError(
        `Kustutamise jäägaeg kestab kuni ${status.coolingOffUntil}. Kasutaja saab taotluse portaalis tühistada.`,
      )
    }
    return executeUserDelete(repositories, session, user, reason, options?.override === true)
  }

  // Fresh or previously cancelled request: start the 14-day cooling-off.
  const requestedAt = new Date()
  const coolingOffUntil = addDays(requestedAt, GDPR_COOLING_OFF_DAYS)
  const precheck = await buildDeletePrecheck(repositories, userId)

  let failure: string | null = null
  try {
    await audit(repositories, {
      actorId: session.userId,
      action: AUDIT_GDPR_DELETE,
      entityType: 'user',
      entityId: userId,
      after: {
        phase: 'requested',
        reason,
        requestedAt: requestedAt.toISOString(),
        coolingOffUntil: coolingOffUntil.toISOString(),
        precheck: {
          activeAuctionBids: precheck.activeAuctionBids.length,
          openContracts: precheck.openContracts.length,
          unopenedSealedBids: precheck.unopenedSealedBidCount,
          blocking: precheck.blocking,
        },
      },
      reason,
      context: await auditRequestContext(),
    })

    await notifyUser(repositories, {
      userId,
      event: AUDIT_GDPR_DELETE,
      title: 'Konto kustutamistaotlus on vastu võetud',
      body: `Teie konto kustutamistaotlus on registreeritud. Lõplik kustutamine toimub pärast ${String(
        GDPR_COOLING_OFF_DAYS,
      )} päeva (${coolingOffUntil.toISOString()}). Saate taotluse siin portaalis tühistada.`,
      payload: { phase: 'requested', coolingOffUntil: coolingOffUntil.toISOString() },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return actionError(`Kustutustaotluse registreerimine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return {
    ok: true,
    message: `Kustutustaotlus registreeritud; jäägaeg kestab kuni ${coolingOffUntil.toISOString()}.`,
  }
}

/** Hard delete after the cooling-off: mask, pseudonymise, purge, audit. */
async function executeUserDelete(
  repositories: CoreRepositories,
  session: { userId: string },
  user: UserDoc,
  reason: string,
  override: boolean,
): Promise<UserActionResult> {
  const userId = user.id
  const precheck = await buildDeletePrecheck(repositories, userId)
  if (precheck.blocking && !override) {
    return actionError(
      `Eeldab lahendamist või eksplisiitset ülekäiku: ${String(
        precheck.activeAuctionBids.length,
      )} pakkumist aktiivsel oksjonil, ${String(precheck.openContracts.length)} allkirjastamata lepingut.`,
    )
  }

  const anonymizedAt = new Date()
  const retentionUntil = addYears(anonymizedAt, GDPR_RETENTION_YEARS)

  let failure: string | null = null
  try {
    await revokeUserSessions(userId)

    // The masked address keeps the unique email index satisfied without
    // carrying personal data; credential and isikukood columns are cleared.
    await repositories.update({
      collection: 'users',
      id: userId,
      data: {
        email: `anonymized-${userId}@gdpr.invalid`,
        name: null,
        phone: null,
        status: 'suspended',
        passwordHash: null,
        passwordSalt: null,
        isikukoodEncrypted: null,
        isikukoodIv: null,
        isikukoodAuthTag: null,
        isikukoodHash: null,
      },
    })

    const { docs: profiles } = await repositories.find({
      collection: 'profile',
      where: { user: { equals: userId } },
      pagination: false,
    })
    for (const profile of profiles) {
      await repositories.update({
        collection: 'profile',
        id: profile.id,
        data: { displayName: 'Anonümiseeritud', phone: null },
      })
    }

    // Bid rows survive (append-only ledger); only identity columns are
    // pseudonymised. Amounts, statuses and timestamps are never rewritten.
    const { docs: bids } = await repositories.find({
      collection: 'bids',
      where: { user: { equals: userId } },
      pagination: false,
    })
    for (const bid of bids) {
      await repositories.update({
        collection: 'bids',
        id: bid.id,
        data: { identitySnapshot: null, ipHash: null },
      })
    }

    // Contract rows survive for the accounting retention; the rendered
    // document carries personal data, so it is dropped (contentHash keeps
    // the integrity reference).
    const { docs: contracts } = await repositories.find({
      collection: 'contracts',
      where: { signedBy: { equals: userId } },
      pagination: false,
    })
    for (const contract of contracts) {
      await repositories.update({
        collection: 'contracts',
        id: contract.id,
        data: { renderedHtml: null },
      })
    }

    // Unopened sealed bids are purged entirely: the encrypted identity
    // snapshot is personal data that was never revealed in a ceremony.
    const sealedAuctionIds = [
      ...new Set(bids.filter((bid) => bid.type === 'sealed').map((bid) => bid.auctionId)),
    ]
    const revealedAuctionIds = new Set(
      sealedAuctionIds.length > 0
        ? (
            await repositories.find({
              collection: 'audit-entry',
              where: {
                and: [
                  { entityType: { equals: 'auction' } },
                  { action: { equals: 'sealed.reveal' } },
                  { entityId: { in: sealedAuctionIds } },
                ],
              },
              pagination: false,
            })
          ).docs.map((entry) => entry.entityId)
        : [],
    )
    const unopenedSealedBids = bids.filter(
      (bid) => bid.type === 'sealed' && !revealedAuctionIds.has(bid.auctionId),
    )
    for (const bid of unopenedSealedBids) {
      await repositories.delete({ collection: 'bids', id: bid.id })
    }

    await audit(repositories, {
      actorId: session.userId,
      action: AUDIT_GDPR_DELETE,
      entityType: 'user',
      entityId: userId,
      before: { status: user.status, personalData: true },
      after: {
        phase: 'executed',
        status: 'suspended',
        personalData: false,
        reason,
        override,
        anonymizedAt: anonymizedAt.toISOString(),
        retentionUntil: retentionUntil.toISOString(),
        profilesAnonymized: profiles.length,
        bidsPseudonymised: bids.length,
        contractsMasked: contracts.length,
        sealedBidsPurged: unopenedSealedBids.length,
      },
      reason,
      context: await auditRequestContext(),
    })

    // No user notification: the account is unusable and the address masked,
    // so there is nobody left to deliver it to.
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return actionError(`Anonüümiseerimine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return {
    ok: true,
    message: 'Kasutaja anonüümiseeritud; arvestuslikud andmed säilitatakse 7 aastat.',
  }
}

function addYears(base: Date, years: number): Date {
  const copy = new Date(base)
  copy.setFullYear(copy.getFullYear() + years)
  return copy
}

/**
 * Read-only pre-check report (spec delta admin-people): active bids, open
 * contracts, purgeable sealed bids and retention items, plus the current
 * cooling-off state. Feeds the drawer dialog; the delete action re-runs the
 * same checks server-side before executing.
 */
export async function precheckUserDeleteAction(
  userId: string,
): Promise<{ ok: true; precheck: GdprDeletePrecheck; status: GdprDeleteStatus } | { ok: false; error: string }> {
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'users:read')) {
    return actionError('Teil puudub õigus selle toimingu sooritamiseks.')
  }
  if (!userId) return actionError('Kasutaja identifikaator puudub.')

  const repositories = await getRepositories()
  const user = await repositories.findByID({ collection: 'users', id: userId })
  if (!user) return actionError('Kasutajat ei leitud.')

  const [precheck, status] = await Promise.all([
    buildDeletePrecheck(repositories, userId),
    readDeleteStatus(repositories, userId),
  ])
  return { ok: true, precheck, status }
}

/** Leading-bid reference for the revoke warning; amounts are read-only. */
export interface LeadingBidRef {
  bidId: string
  auctionId: string
  auctionTitle: string | null
  amountCents: number
  createdAt: string
}

export interface RightsContextProfile {
  id: string
  type: string
  approvalStatus: string
  displayName: string | null
  companyName: string | null
}

export interface UserRightsContext {
  leadingBids: LeadingBidRef[]
  profiles: RightsContextProfile[]
  isSuperadmin: boolean
}

/**
 * Data feed for the rights tab (spec delta admin-people): leading bids on
 * active auctions (revoke warning + superadmin void path) and the user's
 * profiles (per-profile matrix rows).
 */
export async function userRightsContextAction(
  userId: string,
): Promise<{ ok: true; context: UserRightsContext } | { ok: false; error: string }> {
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'users:read')) {
    return actionError('Teil puudub õigus selle toimingu sooritamiseks.')
  }
  if (!userId) return actionError('Kasutaja identifikaator puudub.')

  const repositories = await getRepositories()
  const user = await repositories.findByID({ collection: 'users', id: userId })
  if (!user) return actionError('Kasutajat ei leitud.')

  const [{ docs: leadingBids }, { docs: profiles }] = await Promise.all([
    repositories.find({
      collection: 'bids',
      where: {
        and: [{ user: { equals: userId } }, { status: { equals: 'leading' } }],
      },
      sort: '-createdAt',
      pagination: false,
    }),
    repositories.find({ collection: 'profile', where: { user: { equals: userId } }, pagination: false }),
  ])

  const auctionIds = [...new Set(leadingBids.map((bid) => bid.auctionId))]
  const auctions =
    auctionIds.length > 0
      ? (
          await repositories.find({
            collection: 'auctions',
            where: { id: { in: auctionIds } },
            pagination: false,
          })
        ).docs
      : []
  const auctionsById = new Map(auctions.map((auction) => [auction.id, auction]))

  const context: UserRightsContext = {
    leadingBids: leadingBids
      .filter((bid) => auctionsById.get(bid.auctionId)?.status === 'active')
      .map((bid) => {
        const auction = auctionsById.get(bid.auctionId)
        return {
          bidId: bid.id,
          auctionId: bid.auctionId,
          auctionTitle: typeof auction?.title === 'string' ? auction.title : null,
          amountCents: bid.amountCents,
          createdAt: bid.createdAt,
        }
      }),
    profiles: profiles.map((profile) => ({
      id: profile.id,
      type: profile.type,
      approvalStatus: profile.approvalStatus,
      displayName: profile.displayName ?? null,
      companyName: profile.companyName ?? null,
    })),
    isSuperadmin: session.role === 'superadmin',
  }
  return { ok: true, context }
}

/**
 * Superadmin void of a leading bid on an active auction (spec delta
 * admin-people). Bids stay append-only: the void is the compensating status
 * correction to `rejected` — the amount column is never rewritten — and the
 * `bid.void` audit entry carries the full reference.
 */
export async function voidLeadingBidAction(bidId: string, reason: string): Promise<UserActionResult> {
  const { session } = await requireAdminRepositories()
  if (session.role !== 'superadmin') {
    return actionError('Juhtiva pakkumise tühistamine on lubatud ainult superadminile.')
  }
  if (!bidId) return actionError('Pakkumise identifikaator puudub.')
  if (!hasMinReason(reason)) {
    return actionError('Tühistamise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const repositories = await getRepositories()

  const bid = await repositories.findByID({ collection: 'bids', id: bidId })
  if (!bid) return actionError('Pakkumist ei leitud.')
  if (bid.status !== 'leading') {
    return actionError('Ainult juhtiv pakkumine on tühistatav.')
  }

  const auction = await repositories.findByID({ collection: 'auctions', id: bid.auctionId })
  if (auction?.status !== 'active') {
    return actionError('Oksjon ei ole aktiivne.')
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'bids',
      id: bidId,
      data: { status: 'rejected' },
    })

    await audit(repositories, {
      actorId: session.userId,
      action: AUDIT_BID_VOID,
      entityType: 'bid',
      entityId: bidId,
      before: { status: 'leading' },
      after: {
        status: 'rejected',
        userId: bid.userId,
        auctionId: bid.auctionId,
        amountCents: bid.amountCents,
        reason,
      },
      reason,
      context: await auditRequestContext(),
    })

    await notifyUser(repositories, {
      userId: bid.userId,
      event: AUDIT_BID_VOID,
      title: 'Teie juhtiv pakkumine tühistati',
      body: `Administraator tühistas teie juhtiva pakkumise oksjonil. Põhjus: ${reason}`,
      payload: { auctionId: bid.auctionId, reason },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return actionError(`Juhtiva pakkumise tühistamine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/bids')
  revalidatePath(`/admin/users/${bid.userId}`)
  return { ok: true, message: 'Juhtiv pakkumine tühistatud ja kasutajat teavitatud.' }
}

/** Portal-side view of the caller's own cooling-off state (minimal shape). */
export interface AccountDeletionState {
  pending: boolean
  requestedAt: string | null
  coolingOffUntil: string | null
}

async function currentPortalUserId(): Promise<string | null> {
  const token = (await cookies()).get('access_token')?.value
  const payload = token ? verifyAccessToken(token) : null
  if (!payload?.sessionId) return null
  const record = await getUserSession(payload.sessionId)
  if (record?.userId !== payload.userId) return null
  return payload.userId
}

/**
 * Portal feed for the account-state notice: whether the signed-in user has
 * a delete request in its cooling-off window.
 */
export async function accountDeletionStatusAction(): Promise<AccountDeletionState> {
  const userId = await currentPortalUserId()
  if (!userId) {
    return { pending: false, requestedAt: null, coolingOffUntil: null }
  }

  const repositories = await getRepositories()
  const status = await readDeleteStatus(repositories, userId)
  const pending = status.phase === 'requested' && !status.coolingOffElapsed
  return {
    pending,
    requestedAt: pending ? status.requestedAt : null,
    coolingOffUntil: pending ? status.coolingOffUntil : null,
  }
}

/**
 * Portal cancel of the caller's own pending delete request during the
 * 14-day cooling-off. The actor comes from the verified session token, the
 * pending marker is re-checked server-side, and the cancel is audited on
 * the same append-only trail with `cancelledBy: 'user'`.
 */
export async function cancelAccountDeletionAction(): Promise<UserActionResult> {
  const userId = await currentPortalUserId()
  if (!userId) {
    return actionError('Kustutustaotluse tühistamiseks peate olema sisse logitud.')
  }

  const repositories = await getRepositories()
  const status = await readDeleteStatus(repositories, userId)
  if (status.phase !== 'requested' || status.coolingOffElapsed) {
    return actionError('Aktiivset kustutustaotlust ei leitud.')
  }

  let failure: string | null = null
  try {
    await audit(repositories, {
      actorId: userId,
      action: AUDIT_GDPR_DELETE,
      entityType: 'user',
      entityId: userId,
      after: {
        phase: 'cancelled',
        cancelledBy: 'user',
        requestedAt: status.requestedAt,
        coolingOffUntil: status.coolingOffUntil,
      },
      context: await auditRequestContext(),
    })

    await notifyUser(repositories, {
      userId,
      event: AUDIT_GDPR_DELETE,
      title: 'Kustutustaotlus tühistatud',
      body: 'Teie konto kustutamistaotlus on tühistatud ja konto jääb aktiivseks.',
      payload: { phase: 'cancelled' },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return actionError(`Kustutustaotluse tühistamine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/user')
  return { ok: true, message: 'Kustutustaotlus tühistatud; konto jääb aktiivseks.' }
}
