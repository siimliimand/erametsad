'use server'

import { EE_COUNTIES } from '@erametsad/types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  buildLeadExportRows,
  resolveConsentWithdrawnAt,
  type LeadExportRow,
} from '../../api/v1/admin/leads/export/_lib/leads-export'
import { requireAdminRepositories, type AdminSession } from '../_lib/admin'
import { formatDateTime, maskIsikukood } from '../_lib/labels'
import { can, leadInScope, leadScope } from '../_lib/permissions'
import {
  buildCompanyHistoryCsv,
  buildCompanyHistoryRow,
  matchesCompanyHistoryFilters,
  parseCompanyHistoryFilters,
} from '../admin/companies/_components/history-view'
import { evaluateLeadExitGuard } from '../admin/leads/_components/lead-flow'
import {
  crossCheckBoardMembership,
  resolveRegistrySnapshot,
} from '../admin/leads/_components/registry-snapshot'
import { getMediaBucket, sanitizeFilename, validateMediaUpload } from '../admin/media/_lib/media-upload'
import {
  buildAttachmentLinks,
  buildMinimizedForwardPayload,
} from '../admin/requests/_components/routing'

import type { AuditEntryDoc, CoreRepositories } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import {
  auctionObjectTypes,
  leadStatuses,
  serviceRequestTypes,
  type CompanyAccessRequest,
  type Lead,
  type LeadStatus,
  type ServiceRequestType,
} from '@/lib/data/schema'
import { deriveCountyCodeFromCadastre } from '@/lib/leads/cadastre-county'
import { sendEmail, type SendResult } from '@/lib/notifications/email-sender'

const REASON_MIN_LENGTH = 5

const REQUESTS_PATH = '/admin/leads/requests'
const LEADS_PATH = '/admin/leads'
const SERVICE_REQUESTS_PATH = '/admin/inquiries'
const PARTNERS_PATH = '/admin/inquiries/partners'

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

function readCheckbox(formData: FormData, key: string): boolean {
  const value = formData.get(key)
  return value === 'on' || value === 'true'
}

function readFile(formData: FormData, key: string): File | null {
  const value = formData.get(key)
  return value instanceof File && value.size > 0 ? value : null
}

/**
 * Optional same-area redirect override: the company decision forms are
 * hosted on both the leads requests page and /admin/companies, so the form
 * names the page to land on. Anything outside /admin falls back.
 */
function readRedirectTo(formData: FormData, fallback: string): string {
  const value = readText(formData, 'redirectTo')
  return value.startsWith('/admin') ? value : fallback
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?viga=${encodeURIComponent(message)}`)
}

function redirectWithNotice(path: string, message: string): never {
  redirect(`${path}?teade=${encodeURIComponent(message)}`)
}

function hasMinReason(value: string): boolean {
  return value.length >= REASON_MIN_LENGTH
}

async function requirePermission(
  permission: Parameters<typeof can>[1],
  fallbackPath: string,
): Promise<AdminSession> {
  const { session } = await requireAdminRepositories()
  if (!can(session.role, permission)) {
    redirectWithError(fallbackPath, 'Teil puudub õigus selle toimingu sooritamiseks.')
  }
  return session
}

/** Counties row id for a two-letter county code, or null when unknown. */
async function resolveCountyId(
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

/**
 * Append-only audit write. Uses the unguarded system repositories because
 * the audit-entry guard only lets admin roles write, while lead actions
 * are also performed by specialists.
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
  },
): Promise<void> {
  await repositories.create({
    collection: 'audit-entry',
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      ...(entry.before !== undefined ? { before: entry.before } : {}),
      after: entry.after,
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

// ---------------------------------------------------------------------------
// 4.2 Company approvals
// ---------------------------------------------------------------------------

async function findRequester(
  repositories: CoreRepositories,
  email: string | null,
): Promise<{ id: string; name: string | null; isikukood: string | undefined } | null> {
  if (!email) return null
  const { docs } = await repositories.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })
  const user = docs[0]
  if (!user) return null
  return { id: user.id, name: user.name, isikukood: user.isikukood }
}

export async function approveCompanyAccessRequestAction(formData: FormData): Promise<void> {
  const session = await requirePermission('companies:write', REQUESTS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError(REQUESTS_PATH, 'Taotluse identifikaator puudub.')

  const request = await repositories.findByID({ collection: 'company-access-request', id })
  if (!request) redirectWithError(REQUESTS_PATH, 'Taotlust ei leitud.')
  if (request.status !== 'pending' && request.status !== 'held') {
    redirectWithError(REQUESTS_PATH, 'Taotlus on juba läbi vaadatud.')
  }

  const snapshot = resolveRegistrySnapshot(request.regCode, request.companyName, request.createdAt)
  if (snapshot.status === 'KUSTUTATUD') {
    redirectWithError(REQUESTS_PATH, 'Ettevõte on äriregistrist kustutatud — ainult keeldumine on lubatud.')
  }

  const { docs: duplicateProfiles } = await repositories.find({
    collection: 'profile',
    where: {
      and: [
        { companyRegCode: { equals: request.regCode } },
        { approvalStatus: { equals: 'approved' } },
      ],
    },
    limit: 1,
  })
  if (duplicateProfiles.length > 0) {
    redirectWithError(REQUESTS_PATH, 'Profiil on juba aktiveeritud — suunage ligipääs olemasoleva omaniku kaudu.')
  }

  const rights = formData
    .getAll('rights')
    .filter((value): value is string => typeof value === 'string')
    .filter((value): value is (typeof auctionObjectTypes)[number] =>
      auctionObjectTypes.includes(value as (typeof auctionObjectTypes)[number]),
    )

  const requester = await findRequester(repositories, request.requesterEmail)
  const boardCheck = crossCheckBoardMembership(
    requester?.name ?? request.requesterName,
    requester?.isikukood,
    snapshot.boardMembers,
  )
  if (boardCheck.level === 'none' && !readCheckbox(formData, 'checkedRegistry')) {
    redirectWithError(REQUESTS_PATH, 'Kinnitage äriregistri andmed käsitsi enne nõustumist.')
  }

  // Volikiri enforcement (spec delta admin-people): a failed board-member
  // check permits only rejection, or an approval that carries a justification
  // and a power-of-attorney document upload. The upload follows the media R2
  // pattern (validate → bucket put → key recorded on the audit entry).
  const boardCheckFailed = boardCheck.level === 'none'
  let volikiriAudit: Record<string, unknown> | null = null
  let volikiriKey: string | null = null
  if (boardCheckFailed) {
    const justification = readText(formData, 'justification')
    if (!hasMinReason(justification)) {
      redirectWithError(
        REQUESTS_PATH,
        'Juhatuse liikmelisuse kontroll ebaõnnestus — nõustumise põhjendus on kohustuslik (vähemalt 5 tähemärki).',
      )
    }
    const file = readFile(formData, 'volikiri')
    if (!file) {
      redirectWithError(REQUESTS_PATH, 'Nõustumine ilma juhatuse liikmelisuseta nõuab volikirja üleslaadimist.')
    }
    const validationError = validateMediaUpload({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    })
    if (validationError) {
      redirectWithError(REQUESTS_PATH, `Volikiri: ${validationError}`)
    }
    const bucket = await getMediaBucket()
    if (!bucket) {
      redirectWithError(REQUESTS_PATH, 'R2 salvestusruum pole saadaval — volikirja ei saa üles laadida.')
    }
    const key = `volikiri/${id}/${new Date().toISOString().replace(/[:.]/g, '-')}-${sanitizeFilename(file.name)}`
    try {
      await bucket.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      })
    } catch (error) {
      redirectWithError(
        REQUESTS_PATH,
        `Volikirja üleslaadimine ebaõnnestus: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    volikiriKey = key
    volikiriAudit = {
      r2Key: key,
      filename: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
      justification,
    }
  }

  let failure: string | null = null
  let profileId: string | null = null
  try {
    const reviewedAt = new Date().toISOString()
    await repositories.update({
      collection: 'company-access-request',
      id,
      data: { status: 'approved', reviewedBy: session.userId, reviewedAt },
    })

    if (requester) {
      const { docs: matchingProfiles } = await repositories.find({
        collection: 'profile',
        where: { user: { equals: requester.id } },
        limit: 1,
      })
      const profile = matchingProfiles[0]
      if (profile?.approvalStatus === 'pending') {
        await repositories.update({
          collection: 'profile',
          id: profile.id,
          data: { approvalStatus: 'approved' },
        })
        profileId = profile.id
      }

      const grantedAt = reviewedAt
      for (const objectType of rights) {
        await repositories.create({
          collection: 'auction-rights',
          data: { user: requester.id, objectType, grantedBy: session.userId, grantedAt },
        })
      }

      await notifyUser(repositories, {
        userId: requester.id,
        event: 'company.approved',
        title: 'Ettevõtte profiil kinnitatud',
        body: 'Teie ettevõtte juurdepääsutaotlus on kinnitatud ja profiil on nüüd aktiivne.',
        payload: { requestId: id },
      })
    }

    await audit(repositories, {
      actorId: session.userId,
      action: 'company.approve',
      entityType: 'company-access-request',
      entityId: id,
      after: {
        status: 'approved',
        requesterId: requester?.id ?? null,
        profileId,
        rights,
        registryStatus: snapshot.status,
        boardCheck: boardCheck.level,
        reason: 'Ettevõtte vaikimisi õigused',
        ...(volikiriAudit ? { volikiri: volikiriAudit } : {}),
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    // A failed decision must not leave an unreachable R2 object behind.
    if (volikiriKey) {
      const bucket = await getMediaBucket()
      try {
        await bucket?.delete(volikiriKey)
      } catch {
        // The primary failure is what the admin needs to see.
      }
    }
    redirectWithError(REQUESTS_PATH, `Taotluse nõustumine ebaõnnestus: ${failure}`)
  }

  revalidatePath(REQUESTS_PATH)
  revalidatePath('/admin/leads')
  redirectWithNotice(
    readRedirectTo(formData, REQUESTS_PATH),
    boardCheckFailed
      ? 'Taotlus nõustutud põhjenduse ja volikirjaga; profiil aktiveeritud ja taotlejale teavitatud.'
      : 'Taotlus nõustutud; profiil aktiveeritud ja taotlejale teavitatud.',
  )
}

export async function rejectCompanyAccessRequestAction(formData: FormData): Promise<void> {
  const session = await requirePermission('companies:write', REQUESTS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  const reason = readText(formData, 'reason')
  if (!id) redirectWithError(REQUESTS_PATH, 'Taotluse identifikaator puudub.')
  if (!hasMinReason(reason)) {
    redirectWithError(REQUESTS_PATH, 'Keeldumise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const request = await repositories.findByID({ collection: 'company-access-request', id })
  if (!request) redirectWithError(REQUESTS_PATH, 'Taotlust ei leitud.')
  if (request.status !== 'pending' && request.status !== 'held') {
    redirectWithError(REQUESTS_PATH, 'Taotlus on juba läbi vaadatud.')
  }

  let failure: string | null = null
  try {
    const reviewedAt = new Date().toISOString()
    await repositories.update({
      collection: 'company-access-request',
      id,
      data: { status: 'rejected', reviewedBy: session.userId, reviewedAt },
    })

    const requester = await findRequester(repositories, request.requesterEmail)
    if (requester) {
      const { docs: matchingProfiles } = await repositories.find({
        collection: 'profile',
        where: { user: { equals: requester.id } },
        limit: 1,
      })
      const profile = matchingProfiles[0]
      if (profile?.approvalStatus === 'pending') {
        await repositories.update({
          collection: 'profile',
          id: profile.id,
          data: { approvalStatus: 'rejected' },
        })
      }

      await notifyUser(repositories, {
        userId: requester.id,
        event: 'company.rejected',
        title: 'Ettevõtte juurdepääsutaotlus tagasi lükatud',
        body: `Teie taotlus on tagasi lükatud. Põhjus: ${reason}`,
        payload: { requestId: id },
      })
    }

    await audit(repositories, {
      actorId: session.userId,
      action: 'company.reject',
      entityType: 'company-access-request',
      entityId: id,
      after: { status: 'rejected', reason },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(REQUESTS_PATH, `Taotluse keeldumine ebaõnnestus: ${failure}`)
  }

  revalidatePath(REQUESTS_PATH)
  redirectWithNotice(
    readRedirectTo(formData, REQUESTS_PATH),
    'Taotlus keeldutud ja taotlejale põhjusega teavitatud.',
  )
}

export async function holdCompanyAccessRequestAction(formData: FormData): Promise<void> {
  const session = await requirePermission('companies:write', REQUESTS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  const note = readText(formData, 'note')
  const remindAt = readOptionalDatetime(formData, 'remindAt')
  if (!id) redirectWithError(REQUESTS_PATH, 'Taotluse identifikaator puudub.')
  if (!hasMinReason(note)) {
    redirectWithError(REQUESTS_PATH, 'Sisemine märkus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const request = await repositories.findByID({ collection: 'company-access-request', id })
  if (!request) redirectWithError(REQUESTS_PATH, 'Taotlust ei leitud.')
  if (request.status !== 'pending' && request.status !== 'held') {
    redirectWithError(REQUESTS_PATH, 'Taotlus on juba läbi vaadatud.')
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'company-access-request',
      id,
      data: { status: 'held', reviewedBy: session.userId, reviewedAt: new Date().toISOString() },
    })

    await audit(repositories, {
      actorId: session.userId,
      action: 'company.hold',
      entityType: 'company-access-request',
      entityId: id,
      after: { status: 'held', note, ...(remindAt ? { remindAt } : {}) },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(REQUESTS_PATH, `Taotluse ootele panek ebaõnnestus: ${failure}`)
  }

  revalidatePath(REQUESTS_PATH)
  redirectWithNotice(
    readRedirectTo(formData, REQUESTS_PATH),
    'Taotlus pandud ootele sisemärkusega.',
  )
}

/**
 * Audited registry re-check (the 7.6 "Kontrolli uuesti" view): re-resolves
 * the registry snapshot for the request and writes the view to the
 * append-only audit log before the page re-renders with fresh data.
 */
export async function registryRecheckAction(formData: FormData): Promise<void> {
  const session = await requirePermission('companies:write', REQUESTS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  const redirectPath = readRedirectTo(formData, REQUESTS_PATH)
  if (!id) redirectWithError(redirectPath, 'Taotluse identifikaator puudub.')

  const request = await repositories.findByID({ collection: 'company-access-request', id })
  if (!request) redirectWithError(redirectPath, 'Taotlust ei leitud.')

  const snapshot = resolveRegistrySnapshot(request.regCode, request.companyName, request.createdAt)

  let failure: string | null = null
  try {
    await audit(repositories, {
      actorId: session.userId,
      action: 'company.registry_recheck',
      entityType: 'company-access-request',
      entityId: id,
      after: {
        regCode: request.regCode,
        registryStatus: snapshot.status,
        verified: snapshot.verified,
        boardMembers: snapshot.boardMembers.length,
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(redirectPath, `Registri kontrollimise logimine ebaõnnestus: ${failure}`)
  }

  revalidatePath(redirectPath)
  redirectWithNotice(redirectPath, 'Äriregistri andmed kontrollitud; vaade logitud auditilogisse.')
}

/**
 * Audited CSV export of the decided company requests (spec delta
 * admin-people). The action re-reads the rows server-side, so the audit
 * entry describes exactly what was exported, and returns the CSV as base64
 * for a client-side download (the GDPR export pattern).
 */
export async function exportCompanyHistoryAction(input: {
  decision?: string | undefined
  date?: string | undefined
  q?: string | undefined
}): Promise<{ ok: true; filename: string; base64: string; rowCount: number } | { ok: false; error: string }> {
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'companies:read')) {
    return { ok: false, error: 'Teil puudub õigus selle toimingu sooritamiseks.' }
  }

  const repositories = await getRepositories()
  const { docs: requests } = await repositories.find({
    collection: 'company-access-request',
    where: {
      or: [
        { status: { equals: 'approved' } },
        { status: { equals: 'rejected' } },
      ],
    },
    sort: '-reviewedAt',
    pagination: false,
  })

  const [usersResult, auditsResult] = await Promise.all([
    repositories.find({ collection: 'users', pagination: false, limit: 5000 }),
    repositories.find({
      collection: 'audit-entry',
      where: { entityType: { equals: 'company-access-request' } },
      sort: '-createdAt',
      pagination: false,
    }),
  ])
  const usersById = new Map(usersResult.docs.map((user) => [user.id, user]))
  const applicantByEmail = new Map(
    usersResult.docs
      .filter((user) => typeof user.email === 'string')
      .map((user) => [user.email, user]),
  )
  const auditsByRequestId = new Map<string, AuditEntryDoc[]>()
  for (const entry of auditsResult.docs) {
    if (!entry.entityId) continue
    const list = auditsByRequestId.get(entry.entityId) ?? []
    list.push(entry)
    auditsByRequestId.set(entry.entityId, list)
  }

  const rows = requests
    .filter(
      (request): request is CompanyAccessRequest & { status: 'approved' | 'rejected' } =>
        request.status === 'approved' || request.status === 'rejected',
    )
    .map((request) => {
      const applicant = request.requesterEmail
        ? applicantByEmail.get(request.requesterEmail)
        : undefined
      const entries = auditsByRequestId.get(request.id) ?? []
      const rejectAfter = entries.find((entry) => entry.action === 'company.reject')?.after
      const approveAfter = entries.find((entry) => entry.action === 'company.approve')?.after
      const rejectPayload =
        typeof rejectAfter === 'object' && rejectAfter !== null
          ? (rejectAfter as Record<string, unknown>)
          : {}
      const approvePayload =
        typeof approveAfter === 'object' && approveAfter !== null
          ? (approveAfter as Record<string, unknown>)
          : {}
      const rights = Array.isArray(approvePayload.rights) ? approvePayload.rights : []
      return buildCompanyHistoryRow({
        request: {
          id: request.id,
          regCode: request.regCode,
          companyName: request.companyName,
          requesterName: request.requesterName,
          requesterEmail: request.requesterEmail,
          status: request.status,
          reviewedAt: request.reviewedAt,
        },
        applicant: {
          name: applicant?.name ?? null,
          isikukoodMasked: maskIsikukood(applicant?.isikukood),
        },
        reviewerName: request.reviewedBy
          ? (usersById.get(request.reviewedBy)?.name ?? request.reviewedBy)
          : null,
        rejectReason: typeof rejectPayload.reason === 'string' ? rejectPayload.reason : null,
        rights: rights.filter((right): right is string => typeof right === 'string'),
      })
    })
    .filter((row) =>
      matchesCompanyHistoryFilters(
        row,
        parseCompanyHistoryFilters({ decision: input.decision, date: input.date, q: input.q }),
      ),
    )

  const csv = buildCompanyHistoryCsv(rows)
  const filename = `ettevotte-taotluste-ajalugu-${new Date().toISOString().slice(0, 10)}.csv`

  let failure: string | null = null
  try {
    await audit(repositories, {
      actorId: session.userId,
      action: 'company.history_export',
      entityType: 'company-access-request',
      entityId: '*',
      after: {
        format: 'csv',
        rowCount: rows.length,
        filters: {
          ...(input.decision ? { decision: input.decision } : {}),
          ...(input.date ? { date: input.date } : {}),
          ...(input.q ? { q: input.q } : {}),
        },
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return { ok: false, error: `Eksportimise logimine ebaõnnestus: ${failure}` }
  }

  const bytes = new TextEncoder().encode(csv)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return { ok: true, filename, base64: btoa(binary), rowCount: rows.length }
}

// ---------------------------------------------------------------------------
// 5.2 Leads CRM
// ---------------------------------------------------------------------------

export interface LeadActionResult {
  ok: boolean
  error?: string
}

function isLeadStatus(value: string): value is LeadStatus {
  return leadStatuses.includes(value as LeadStatus)
}

async function loadLeadInScope(
  repositories: CoreRepositories,
  session: AdminSession,
  leadId: string,
): Promise<{ ok: true; lead: Lead } | { ok: false; error: string }> {
  const lead = await repositories.findByID({ collection: 'leads', id: leadId })
  if (!lead) return { ok: false, error: 'Juhtlõiget ei leitud.' }
  const scope = leadScope(session.role, session.userId)
  if (
    !leadInScope(scope, {
      assignedSpecialistId: lead.assignedSpecialistId,
    })
  ) {
    return { ok: false, error: 'Juhtlõige ei ole teie tööpiirkonnas.' }
  }
  return { ok: true, lead }
}

/**
 * Kanban move. Exit guards run here before the status persists; the board
 * reverts its optimistic move when this returns ok:false.
 */
export async function moveLeadStatusAction(input: {
  leadId: string
  status: string
  note?: string
}): Promise<LeadActionResult> {
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'leads:write')) {
    return { ok: false, error: 'Teil puudub õigus juhtlõimede muutmiseks.' }
  }
  const repositories = await getRepositories()

  if (!input.leadId) return { ok: false, error: 'Juhtlõime identifikaator puudub.' }
  if (!isLeadStatus(input.status)) return { ok: false, error: 'Tundmatu olek.' }

  const loaded = await loadLeadInScope(repositories, session, input.leadId)
  if (!loaded.ok) return { ok: false, error: loaded.error }
  const lead = loaded.lead
  if (lead.status === input.status) return { ok: true }

  const guard = evaluateLeadExitGuard({
    from: lead.status,
    to: input.status,
    assignedSpecialistId: lead.assignedSpecialistId,
    note: input.note ?? '',
  })
  if (!guard.ok) return { ok: false, error: guard.error }

  try {
    await repositories.update({
      collection: 'leads',
      id: lead.id,
      data: { status: input.status },
    })
    await audit(repositories, {
      actorId: session.userId,
      action: 'lead.status',
      entityType: 'lead',
      entityId: lead.id,
      before: { status: lead.status },
      after: { status: input.status, ...(input.note ? { note: input.note } : {}) },
    })
    if (input.note) {
      await audit(repositories, {
        actorId: session.userId,
        action: 'lead.note',
        entityType: 'lead',
        entityId: lead.id,
        after: { text: input.note },
      })
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  revalidatePath(LEADS_PATH)
  revalidatePath(`/admin/leads/${lead.id}`)
  return { ok: true }
}

/** Detail-page form twin of moveLeadStatusAction (same guards, then redirect). */
export async function moveLeadStatusFormAction(formData: FormData): Promise<void> {
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'leads:write')) {
    redirectWithError(LEADS_PATH, 'Teil puudub õigus juhtlõimede muutmiseks.')
  }
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  const status = readText(formData, 'status')
  const note = readOptionalText(formData, 'note')
  if (!id) redirectWithError(LEADS_PATH, 'Juhtlõime identifikaator puudub.')
  const detailPath = `/admin/leads/${id}`
  if (!isLeadStatus(status)) redirectWithError(detailPath, 'Tundmatu olek.')

  const loaded = await loadLeadInScope(repositories, session, id)
  if (!loaded.ok) redirectWithError(LEADS_PATH, loaded.error)
  const lead = loaded.lead
  if (lead.status === status) redirectWithNotice(detailPath, 'Olek on juba selline.')

  const guard = evaluateLeadExitGuard({
    from: lead.status,
    to: status,
    assignedSpecialistId: lead.assignedSpecialistId,
    note: note ?? '',
  })
  if (!guard.ok) redirectWithError(detailPath, guard.error)

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'leads',
      id,
      data: { status },
    })
    await audit(repositories, {
      actorId: session.userId,
      action: 'lead.status',
      entityType: 'lead',
      entityId: id,
      before: { status: lead.status },
      after: { status, ...(note ? { note } : {}) },
    })
    if (note) {
      await audit(repositories, {
        actorId: session.userId,
        action: 'lead.note',
        entityType: 'lead',
        entityId: id,
        after: { text: note },
      })
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(detailPath, `Oleku muutmine ebaõnnestus: ${failure}`)
  }

  revalidatePath(LEADS_PATH)
  revalidatePath(detailPath)
  redirectWithNotice(detailPath, 'Olek uuendatud.')
}

export async function assignLeadSpecialistAction(formData: FormData): Promise<void> {
  const session = await requirePermission('leads:write', LEADS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError(LEADS_PATH, 'Juhtlõime identifikaator puudub.')
  const detailPath = `/admin/leads/${id}`

  const loaded = await loadLeadInScope(repositories, session, id)
  if (!loaded.ok) redirectWithError(LEADS_PATH, loaded.error)

  const assignedSpecialistId = readOptionalText(formData, 'assignedSpecialist')
  if (assignedSpecialistId) {
    const specialist = await repositories.findByID({
      collection: 'specialists',
      id: assignedSpecialistId,
    })
    if (!specialist) redirectWithError(detailPath, 'Määratud spetsialisti ei leitud.')
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'leads',
      id,
      data: { assignedSpecialistId },
    })
    await audit(repositories, {
      actorId: session.userId,
      action: 'lead.assign',
      entityType: 'lead',
      entityId: id,
      before: { assignedSpecialistId: loaded.lead.assignedSpecialistId },
      after: { assignedSpecialistId },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(detailPath, `Spetsialisti määramine ebaõnnestus: ${failure}`)
  }

  revalidatePath(LEADS_PATH)
  revalidatePath(detailPath)
  redirectWithNotice(detailPath, 'Spetsialist määratud.')
}

/** Manual county set/override on the lead detail (task 8.1). */
export async function setLeadCountyAction(formData: FormData): Promise<void> {
  const session = await requirePermission('leads:write', LEADS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError(LEADS_PATH, 'Juhtlõime identifikaator puudub.')
  const detailPath = `/admin/leads/${id}`

  const loaded = await loadLeadInScope(repositories, session, id)
  if (!loaded.ok) redirectWithError(LEADS_PATH, loaded.error)

  const countyId = readOptionalText(formData, 'countyId')
  if (countyId) {
    const county = await repositories.findByID({ collection: 'counties', id: countyId })
    if (!county) redirectWithError(detailPath, 'Maakonda ei leitud.')
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'leads',
      id,
      data: { countyId: countyId ?? null },
    })
    await audit(repositories, {
      actorId: session.userId,
      action: 'lead.county',
      entityType: 'lead',
      entityId: id,
      before: { countyId: loaded.lead.countyId ?? null },
      after: { countyId: countyId ?? null },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(detailPath, `Maakonna määramine ebaõnnestus: ${failure}`)
  }

  revalidatePath(LEADS_PATH)
  revalidatePath(detailPath)
  redirectWithNotice(detailPath, 'Maakond määratud.')
}

export async function addLeadNoteAction(formData: FormData): Promise<void> {
  const session = await requirePermission('leads:write', LEADS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  const text = readText(formData, 'text')
  if (!id) redirectWithError(LEADS_PATH, 'Juhtlõime identifikaator puudub.')
  const detailPath = `/admin/leads/${id}`
  if (!text) redirectWithError(detailPath, 'Märkuse tekst on kohustuslik.')

  const loaded = await loadLeadInScope(repositories, session, id)
  if (!loaded.ok) redirectWithError(LEADS_PATH, loaded.error)

  let failure: string | null = null
  try {
    await audit(repositories, {
      actorId: session.userId,
      action: 'lead.note',
      entityType: 'lead',
      entityId: id,
      after: { text },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(detailPath, `Märkuse salvestamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(detailPath)
  revalidatePath(LEADS_PATH)
  redirectWithNotice(detailPath, 'Märkus lisatud.')
}

export async function setLeadNextActionAction(formData: FormData): Promise<void> {
  const session = await requirePermission('leads:write', LEADS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError(LEADS_PATH, 'Juhtlõime identifikaator puudub.')
  const detailPath = `/admin/leads/${id}`

  const dueAt = readOptionalDatetime(formData, 'dueAt')
  if (!dueAt) redirectWithError(detailPath, 'Vali järgmise tegevuse kuupäev.')
  const note = readOptionalText(formData, 'note')

  const loaded = await loadLeadInScope(repositories, session, id)
  if (!loaded.ok) redirectWithError(LEADS_PATH, loaded.error)

  let failure: string | null = null
  try {
    await audit(repositories, {
      actorId: session.userId,
      action: 'lead.next_action',
      entityType: 'lead',
      entityId: id,
      after: { dueAt, ...(note ? { note } : {}) },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(detailPath, `Meeldetuletuse salvestamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(detailPath)
  revalidatePath(LEADS_PATH)
  redirectWithNotice(detailPath, 'Järgmine tegevus seatud.')
}

export async function createLeadAction(formData: FormData): Promise<void> {
  const session = await requirePermission('leads:write', LEADS_PATH)
  const repositories = await getRepositories()

  const contactName = readText(formData, 'contactName')
  const phone = readOptionalText(formData, 'phone')
  const email = readOptionalText(formData, 'email')
  if (!contactName) redirectWithError(LEADS_PATH, 'Kontakti nimi on kohustuslik.')
  if (!phone && !email) {
    redirectWithError(LEADS_PATH, 'Sisestage telefon või e-post.')
  }
  if (!readCheckbox(formData, 'consent')) {
    redirectWithError(LEADS_PATH, 'Kinnitage kliendi nõusolek andmete töötlemiseks.')
  }

  let failure: string | null = null
  let leadId = ''
  try {
    const nowIso = new Date().toISOString()
    const cadastr = readOptionalText(formData, 'cadastr')
    const countyId = await resolveCountyId(
      repositories,
      deriveCountyCodeFromCadastre(cadastr),
    )
    const created = await repositories.create({
      collection: 'leads',
      data: {
        formName: 'telefon',
        pageSlug: '',
        contactName,
        phone,
        email,
        cadastr,
        countyId,
        consentAt: nowIso,
        source: readOptionalText(formData, 'source') ?? 'käsitsi',
        status: 'new',
        assignedSpecialistId: session.role === 'specialist' ? session.userId : null,
        internalComment: readOptionalText(formData, 'internalComment'),
      },
    })
    leadId = created.id
    await audit(repositories, {
      actorId: session.userId,
      action: 'lead.create_manual',
      entityType: 'lead',
      entityId: created.id,
      after: { contactName, source: 'käsitsi' },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(LEADS_PATH, `Juhtlõime loomine ebaõnnestus: ${failure}`)
  }

  revalidatePath(LEADS_PATH)
  redirectWithNotice(`/admin/leads/${leadId}`, 'Juhtlõige loodud.')
}

// ---------------------------------------------------------------------------
// 5.3 Leads CSV export (download route: /api/v1/admin/leads/export)
// ---------------------------------------------------------------------------

export type LeadExportResult =
  | { ok: true; rows: LeadExportRow[]; withdrawnCount: number }
  | { ok: false; error: string }

/**
 * Assembles the rows for the leads CSV download. Admin+ only: the design
 * matrix names a dedicated leads.export permission (13-settings §Rollid)
 * that the AdminPermission union does not have yet, so leads:read is
 * combined with an explicit admin-role gate — specialists see leads but
 * must not export. Consent-withdrawn contacts are blanked here, so the
 * withdrawn contact data never leaves this function, and the lead.export
 * audit entry is written before the route returns the CSV.
 */
export async function loadLeadExportData(): Promise<LeadExportResult> {
  const { session } = await requireAdminRepositories()
  if (
    !can(session.role, 'leads:read') ||
    (session.role !== 'admin' && session.role !== 'superadmin')
  ) {
    return { ok: false, error: 'Teil puudub õigus juhtlõimede eksportimiseks.' }
  }
  const repositories = await getRepositories()

  const { docs: leads } = await repositories.find({
    collection: 'leads',
    sort: '-createdAt',
    pagination: false,
  })
  const { docs: specialists } = await repositories.find({
    collection: 'specialists',
    sort: 'name',
    pagination: false,
  })

  const { docs: leadAudits } = await repositories.find({
    collection: 'audit-entry',
    where: { entityType: { equals: 'lead' } },
    sort: '-createdAt',
    pagination: false,
  })
  const nextActionAtByLeadId = new Map<string, string>()
  const noteCountsByLeadId = new Map<string, number>()
  for (const entry of leadAudits as (AuditEntryDoc & { entityId?: string | null })[]) {
    if (!entry.entityId) continue
    if (entry.action === 'lead.next_action') {
      const after = entry.after as { dueAt?: unknown } | null
      if (!nextActionAtByLeadId.has(entry.entityId) && typeof after?.dueAt === 'string') {
        nextActionAtByLeadId.set(entry.entityId, formatDateTime(after.dueAt))
      }
    }
    if (entry.action === 'lead.note') {
      noteCountsByLeadId.set(entry.entityId, (noteCountsByLeadId.get(entry.entityId) ?? 0) + 1)
    }
  }

  const ipHashes = [
    ...new Set(leads.map((lead) => lead.ipHash).filter((ipHash): ipHash is string => Boolean(ipHash))),
  ]
  const { docs: consentEntries } =
    ipHashes.length > 0
      ? await repositories.find({
          collection: 'consent-log',
          where: { ipHash: { in: ipHashes } },
          sort: '-createdAt',
          pagination: false,
        })
      : { docs: [] }

  const consentWithdrawnAtByIpHash = resolveConsentWithdrawnAt(consentEntries)
  const withdrawnCount = leads.filter(
    (lead) => lead.ipHash !== null && consentWithdrawnAtByIpHash.has(lead.ipHash),
  ).length

  const rows = buildLeadExportRows(leads, {
    consentWithdrawnAtByIpHash,
    specialistNames: new Map(specialists.map((specialist) => [specialist.id, specialist.name])),
    nextActionAtByLeadId,
    noteCountsByLeadId,
  })

  try {
    await audit(repositories, {
      actorId: session.userId,
      action: 'lead.export',
      entityType: 'lead',
      entityId: 'bulk',
      after: { count: rows.length, filters: null },
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  return { ok: true, rows, withdrawnCount }
}

// ---------------------------------------------------------------------------
// 5.4 Service-request routing + partner directory
// ---------------------------------------------------------------------------

function isServiceRequestType(value: string): value is ServiceRequestType {
  return serviceRequestTypes.includes(value as ServiceRequestType)
}

function isCountyCode(value: string): boolean {
  return EE_COUNTIES.some((county) => county.code === value)
}

interface ForwardTarget {
  id: string
  name: string
  contactEmail: string | null
}

async function loadForwardTargets(
  repositories: CoreRepositories,
  partnerIds: readonly string[],
): Promise<ForwardTarget[]> {
  const targets: ForwardTarget[] = []
  for (const id of partnerIds) {
    const partner = await repositories.findByID({ collection: 'partners', id })
    if (partner) {
      targets.push({
        id: partner.id,
        name: partner.name,
        contactEmail: partner.contactEmail,
      })
    }
  }
  return targets
}

interface ForwardOutcome {
  partnerName: string
  emailResult: SendResult
}

async function forwardToPartner(
  repositories: CoreRepositories,
  input: {
    actorId: string
    requestId: string
    requestType: ServiceRequestType
    payloadHtml: string
    attachments: { key: string; url: string; expiresAt: string }[]
    partnerId: string
    partnerName: string
    recipientEmail: string
    retry: boolean
  },
): Promise<ForwardOutcome> {
  const attachmentsBlock =
    input.attachments.length > 0
      ? `<p>Allalaadimislingid (kehtivad kuni ${input.attachments[0]?.expiresAt ?? ''}):<br />${input.attachments
          .map((link) => `<a href="${link.url}">${link.key}</a>`)
          .join('<br />')}</p>`
      : ''
  const emailResult = await sendEmail({
    to: input.recipientEmail,
    subject: `Erametsa päring: ${input.requestType}`,
    html: `<p>Tere, ${input.partnerName}</p>${input.payloadHtml}${attachmentsBlock}<p>Andmed on edastatud Erametsad OÜ vahendusel. Küsimuste korral vastake otse kliendile.</p>`,
  })

  await audit(repositories, {
    actorId: input.actorId,
    action: 'request.forward',
    entityType: 'service-request',
    entityId: input.requestId,
    after: {
      partnerId: input.partnerId,
      partnerName: input.partnerName,
      recipient: input.recipientEmail,
      payload: 'minimeeritud (kontakt- ja kinnistuandmed)',
      attachments: input.attachments,
      emailResult,
      ...(input.retry ? { retry: true } : {}),
    },
  })

  return { partnerName: input.partnerName, emailResult }
}

export async function forwardServiceRequestAction(formData: FormData): Promise<void> {
  const session = await requirePermission('inquiries:write', SERVICE_REQUESTS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError(SERVICE_REQUESTS_PATH, 'Päringu identifikaator puudub.')
  const detailPath = `${SERVICE_REQUESTS_PATH}?detail=${id}`

  const request = await repositories.findByID({ collection: 'service-requests', id })
  if (!request) redirectWithError(SERVICE_REQUESTS_PATH, 'Päringut ei leitud.')

  const partnerIds = [
    ...new Set(
      formData
        .getAll('partnerIds')
        .filter((value): value is string => typeof value === 'string' && value !== ''),
    ),
  ]
  if (partnerIds.length === 0) {
    redirectWithError(detailPath, 'Valige vähemalt üks partner.')
  }

  const sentIds = new Set((request.routedTo ?? []).filter((value): value is string => typeof value === 'string'))
  const newIds = partnerIds.filter((partnerId) => !sentIds.has(partnerId))
  if (newIds.length === 0) {
    redirectWithError(detailPath, 'Kõik valitud partnerid on päringu juba saanud.')
  }

  const targets = await loadForwardTargets(repositories, newIds)
  if (targets.length === 0) {
    redirectWithError(detailPath, 'Valitud partnereid ei leitud.')
  }

  const payload = (request.payload ?? {}) as Record<string, unknown>
  const minimized = buildMinimizedForwardPayload(payload)
  const attachments = buildAttachmentLinks(request.attachments ?? [], Date.now())
  const payloadRows = Object.entries(minimized)
    .map(([key, value]) => `<tr><td>${key}</td><td>${String(value)}</td></tr>`)
    .join('')

  const failures: string[] = []
  for (const target of targets) {
    if (!target.contactEmail) {
      failures.push(`${target.name} (e-post puudub)`)
      continue
    }
    try {
      const { emailResult } = await forwardToPartner(repositories, {
        actorId: session.userId,
        requestId: id,
        requestType: request.type,
        payloadHtml: `<table>${payloadRows}</table>`,
        attachments,
        partnerId: target.id,
        partnerName: target.name,
        recipientEmail: target.contactEmail,
        retry: false,
      })
      if (!emailResult.success) {
        failures.push(target.name)
      }
    } catch {
      failures.push(target.name)
    }
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'service-requests',
      id,
      data: { status: 'routed', routedTo: [...sentIds, ...targets.map((target) => target.id)] },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(detailPath, `Päringu edastamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(SERVICE_REQUESTS_PATH)
  if (failures.length > 0) {
    redirectWithError(
      detailPath,
      `Osaliselt edastatud; e-post ei läinud välja: ${failures.join(', ')}. Kasutage "Saada uuesti".`,
    )
  }
  redirectWithNotice(detailPath, `Päring edastatud ${String(targets.length)} partnerile.`)
}

export async function retryRequestForwardAction(formData: FormData): Promise<void> {
  const session = await requirePermission('inquiries:write', SERVICE_REQUESTS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  const partnerId = readText(formData, 'partnerId')
  if (!id || !partnerId) {
    redirectWithError(SERVICE_REQUESTS_PATH, 'Päringu või partneri identifikaator puudub.')
  }
  const detailPath = `${SERVICE_REQUESTS_PATH}?detail=${id}`

  const request = await repositories.findByID({ collection: 'service-requests', id })
  if (!request) redirectWithError(SERVICE_REQUESTS_PATH, 'Päringut ei leitud.')

  const targets = await loadForwardTargets(repositories, [partnerId])
  const target = targets[0]
  if (!target) redirectWithError(detailPath, 'Partnerit ei leitud.')
  if (!target.contactEmail) redirectWithError(detailPath, 'Partneril puudub suunamise e-post.')

  const payload = (request.payload ?? {}) as Record<string, unknown>
  const minimized = buildMinimizedForwardPayload(payload)
  const attachments = buildAttachmentLinks(request.attachments ?? [], Date.now())
  const payloadRows = Object.entries(minimized)
    .map(([key, value]) => `<tr><td>${key}</td><td>${String(value)}</td></tr>`)
    .join('')

  let failure: string | null = null
  try {
    const { emailResult } = await forwardToPartner(repositories, {
      actorId: session.userId,
      requestId: id,
      requestType: request.type,
      payloadHtml: `<table>${payloadRows}</table>`,
      attachments,
      partnerId: target.id,
      partnerName: target.name,
      recipientEmail: target.contactEmail,
      retry: true,
    })
    if (!emailResult.success) {
      failure = emailResult.error?.message ?? 'E-posti saatmine ebaõnnestus.'
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(detailPath, `Kordussaade ebaõnnestus: ${failure}`)
  }

  revalidatePath(SERVICE_REQUESTS_PATH)
  redirectWithNotice(detailPath, 'Kordussaade registreeritud.')
}

export async function markRequestRespondedAction(formData: FormData): Promise<void> {
  const session = await requirePermission('inquiries:write', SERVICE_REQUESTS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  const partnerId = readText(formData, 'partnerId')
  if (!id || !partnerId) {
    redirectWithError(SERVICE_REQUESTS_PATH, 'Päringu või partneri identifikaator puudub.')
  }
  const detailPath = `${SERVICE_REQUESTS_PATH}?detail=${id}`

  const request = await repositories.findByID({ collection: 'service-requests', id })
  if (!request) redirectWithError(SERVICE_REQUESTS_PATH, 'Päringut ei leitud.')
  const partner = await repositories.findByID({ collection: 'partners', id: partnerId })
  if (!partner) redirectWithError(detailPath, 'Partnerit ei leitud.')

  let failure: string | null = null
  try {
    await audit(repositories, {
      actorId: session.userId,
      action: 'request.mark_responded',
      entityType: 'service-request',
      entityId: id,
      after: { partnerId, partnerName: partner.name },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(detailPath, `Vastanuks märkimine ebaõnnestus: ${failure}`)
  }

  revalidatePath(SERVICE_REQUESTS_PATH)
  redirectWithNotice(detailPath, 'Partner märgitud vastanuks.')
}

/** Marks a routed/answered request teostatud (task 8.4). */
export async function markRequestDoneAction(formData: FormData): Promise<void> {
  const session = await requirePermission('inquiries:write', SERVICE_REQUESTS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError(SERVICE_REQUESTS_PATH, 'Päringu identifikaator puudub.')
  const detailPath = `${SERVICE_REQUESTS_PATH}?detail=${id}`

  const request = await repositories.findByID({ collection: 'service-requests', id })
  if (!request) redirectWithError(SERVICE_REQUESTS_PATH, 'Päringut ei leitud.')
  if (request.status === 'teostatud') {
    redirectWithNotice(detailPath, 'Päring on juba teostatud.')
  }
  if (request.status === 'suletud') {
    redirectWithError(detailPath, 'Päring on suletud — olekut ei saa enam muuta.')
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'service-requests',
      id,
      data: { status: 'teostatud' },
    })
    await audit(repositories, {
      actorId: session.userId,
      action: 'request.mark_done',
      entityType: 'service-request',
      entityId: id,
      before: { status: request.status },
      after: { status: 'teostatud' },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(detailPath, `Teostatuks märkimine ebaõnnestus: ${failure}`)
  }

  revalidatePath(SERVICE_REQUESTS_PATH)
  redirectWithNotice(detailPath, 'Päring märgitud teostatuks.')
}

/** Closes a request for good; closed rows leave the active workflow (task 8.4). */
export async function closeRequestAction(formData: FormData): Promise<void> {
  const session = await requirePermission('inquiries:write', SERVICE_REQUESTS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError(SERVICE_REQUESTS_PATH, 'Päringu identifikaator puudub.')
  const detailPath = `${SERVICE_REQUESTS_PATH}?detail=${id}`

  const request = await repositories.findByID({ collection: 'service-requests', id })
  if (!request) redirectWithError(SERVICE_REQUESTS_PATH, 'Päringut ei leitud.')
  if (request.status === 'suletud') {
    redirectWithNotice(detailPath, 'Päring on juba suletud.')
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'service-requests',
      id,
      data: { status: 'suletud' },
    })
    await audit(repositories, {
      actorId: session.userId,
      action: 'request.close',
      entityType: 'service-request',
      entityId: id,
      before: { status: request.status },
      after: { status: 'suletud' },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(detailPath, `Sulgemine ebaõnnestus: ${failure}`)
  }

  revalidatePath(SERVICE_REQUESTS_PATH)
  redirectWithNotice(detailPath, 'Päring suletud.')
}

function attachmentKeys(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item !== '')
    : []
}

function attachmentZipName(key: string): string {
  const base = key.split('/').pop() ?? key
  return base === '' ? 'manus' : base
}

export interface RequestZipEntry {
  name: string
  bytes: Uint8Array
}

export type RequestAttachmentsZipResult =
  | { ok: true; requestLabel: string; entries: RequestZipEntry[] }
  | { ok: false; error: string }

/**
 * Assembles the attachment ZIP for one service request (task 8.5). The
 * route turns the result into the download; the audit entry lands before
 * any byte leaves the server.
 */
export async function loadRequestAttachmentsZipData(
  requestId: string,
): Promise<RequestAttachmentsZipResult> {
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'inquiries:read')) {
    return { ok: false, error: 'Teil puudub õigus päringu manustele.' }
  }
  const repositories = await getRepositories()

  const request = await repositories.findByID({ collection: 'service-requests', id: requestId })
  if (!request) return { ok: false, error: 'Päringut ei leitud.' }

  const keys = attachmentKeys(request.attachments)
  if (keys.length === 0) return { ok: false, error: 'Päringul ei ole manuseid.' }

  const bucket = await getMediaBucket()
  if (!bucket) return { ok: false, error: 'Salvestusruum ei ole saadaval.' }

  const entries: RequestZipEntry[] = []
  for (const key of keys) {
    const object = await bucket.get(key)
    if (!object?.body) continue
    entries.push({
      name: attachmentZipName(key),
      bytes: new Uint8Array(await new Response(object.body).arrayBuffer()),
    })
  }
  if (entries.length === 0) {
    return { ok: false, error: 'Manuseid ei õnnestunud salvestusruumist laadida.' }
  }

  try {
    await audit(repositories, {
      actorId: session.userId,
      action: 'request.attachments_zip',
      entityType: 'service-request',
      entityId: requestId,
      after: { count: entries.length },
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  return { ok: true, requestLabel: `${request.type}-${requestId.slice(0, 8)}`, entries }
}

function readPartnerForm(formData: FormData): {
  name: string
  contactEmail: string | null
  contactPhone: string | null
  serviceTypes: string[]
  counties: string[] | null
  capacity: number
  active: boolean
} {
  const name = readText(formData, 'name')
  const contactEmail = readOptionalText(formData, 'contactEmail')
  const contactPhone = readOptionalText(formData, 'contactPhone')
  const serviceTypes = formData
    .getAll('serviceTypes')
    .filter((value): value is string => typeof value === 'string' && isServiceRequestType(value))
  const countiesRaw = formData
    .getAll('counties')
    .filter((value): value is string => typeof value === 'string' && value !== '')
  const nationwide = countiesRaw.includes('ALL')
  const counties = nationwide
    ? null
    : countiesRaw.filter((code) => isCountyCode(code) && code !== 'ALL')
  const capacityValue = Number(readText(formData, 'capacity'))
  const capacity = Number.isFinite(capacityValue) && capacityValue >= 0 ? Math.floor(capacityValue) : 0
  return {
    name,
    contactEmail,
    contactPhone,
    serviceTypes,
    counties,
    capacity,
    active: readCheckbox(formData, 'active'),
  }
}

function validatePartnerForm(data: ReturnType<typeof readPartnerForm>): string | null {
  if (!data.name) return 'Partneri nimi on kohustuslik.'
  if (data.contactEmail?.includes('@') !== true) {
    return 'Sisestage kehtiv suunamise e-post.'
  }
  if (data.serviceTypes.length === 0) return 'Valige vähemalt üks teenus.'
  if (data.counties !== null && data.counties.length === 0) {
    return 'Valige maakonnad või "Kogu Eesti".'
  }
  return null
}

export async function createPartnerAction(formData: FormData): Promise<void> {
  const session = await requirePermission('inquiries:write', PARTNERS_PATH)
  const repositories = await getRepositories()

  const data = readPartnerForm(formData)
  const validationError = validatePartnerForm(data)
  if (validationError) redirectWithError(PARTNERS_PATH, validationError)

  let failure: string | null = null
  let partnerId = ''
  try {
    const created = await repositories.create({
      collection: 'partners',
      data: {
        name: data.name,
        serviceTypes: data.serviceTypes,
        counties: data.counties,
        capacity: data.capacity,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        active: data.active,
      },
    })
    partnerId = created.id
    await audit(repositories, {
      actorId: session.userId,
      action: 'partner.create',
      entityType: 'partner',
      entityId: created.id,
      after: data,
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(PARTNERS_PATH, `Partneri loomine ebaõnnestus: ${failure}`)
  }

  revalidatePath(PARTNERS_PATH)
  revalidatePath(SERVICE_REQUESTS_PATH)
  redirectWithNotice(`${PARTNERS_PATH}?muuda=${partnerId}`, 'Partner loodud.')
}

export async function updatePartnerAction(formData: FormData): Promise<void> {
  const session = await requirePermission('inquiries:write', PARTNERS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError(PARTNERS_PATH, 'Partneri identifikaator puudub.')

  const existing = await repositories.findByID({ collection: 'partners', id })
  if (!existing) redirectWithError(PARTNERS_PATH, 'Partnerit ei leitud.')

  const data = readPartnerForm(formData)
  const validationError = validatePartnerForm(data)
  if (validationError) redirectWithError(`${PARTNERS_PATH}?muuda=${id}`, validationError)

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'partners',
      id,
      data: {
        name: data.name,
        serviceTypes: data.serviceTypes,
        counties: data.counties,
        capacity: data.capacity,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        active: data.active,
      },
    })
    await audit(repositories, {
      actorId: session.userId,
      action: 'partner.update',
      entityType: 'partner',
      entityId: id,
      before: {
        name: existing.name,
        serviceTypes: existing.serviceTypes,
        counties: existing.counties,
        capacity: existing.capacity,
        contactEmail: existing.contactEmail,
        contactPhone: existing.contactPhone,
        active: existing.active,
      },
      after: data,
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(`${PARTNERS_PATH}?muuda=${id}`, `Partneri salvestamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(PARTNERS_PATH)
  revalidatePath(SERVICE_REQUESTS_PATH)
  redirectWithNotice(`${PARTNERS_PATH}?muuda=${id}`, 'Partner uuendatud.')
}

export async function setPartnerActiveAction(formData: FormData): Promise<void> {
  const session = await requirePermission('inquiries:write', PARTNERS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  const active = readText(formData, 'active') === 'on'
  const reason = readOptionalText(formData, 'reason')
  if (!id) redirectWithError(PARTNERS_PATH, 'Partneri identifikaator puudub.')

  const existing = await repositories.findByID({ collection: 'partners', id })
  if (!existing) redirectWithError(PARTNERS_PATH, 'Partnerit ei leitud.')
  if (existing.active === active) {
    redirectWithNotice(PARTNERS_PATH, 'Partneri olek on juba selline.')
  }

  let failure: string | null = null
  try {
    await repositories.update({ collection: 'partners', id, data: { active } })
    await audit(repositories, {
      actorId: session.userId,
      action: active ? 'partner.update' : 'partner.deactivate',
      entityType: 'partner',
      entityId: id,
      before: { active: existing.active },
      after: { active, ...(reason ? { reason } : {}) },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(PARTNERS_PATH, `Partneri oleku muutmine ebaõnnestus: ${failure}`)
  }

  revalidatePath(PARTNERS_PATH)
  revalidatePath(SERVICE_REQUESTS_PATH)
  redirectWithNotice(PARTNERS_PATH, active ? 'Partner aktiveeritud.' : 'Partner deaktiveeritud.')
}

export async function deletePartnerAction(formData: FormData): Promise<void> {
  const session = await requirePermission('inquiries:write', PARTNERS_PATH)
  const repositories = await getRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError(PARTNERS_PATH, 'Partneri identifikaator puudub.')

  const existing = await repositories.findByID({ collection: 'partners', id })
  if (!existing) redirectWithError(PARTNERS_PATH, 'Partnerit ei leitud.')

  const { docs: forwarded } = await repositories.find({
    collection: 'audit-entry',
    where: {
      and: [
        { action: { equals: 'request.forward' } },
        { entityType: { equals: 'service-request' } },
      ],
    },
    pagination: false,
  })
  const forwardedHere = forwarded.some((entry) => {
    const after = entry.after
    return (
      entry.entityType === 'service-request' &&
      typeof after === 'object' &&
      after !== null &&
      (after as { partnerId?: unknown }).partnerId === id
    )
  })
  if (forwardedHere) {
    redirectWithError(PARTNERS_PATH, 'Partnerile on päringuid edastatud — kasutage deaktiveerimist.')
  }

  let failure: string | null = null
  try {
    await repositories.delete({ collection: 'partners', id })
    await audit(repositories, {
      actorId: session.userId,
      action: 'partner.delete',
      entityType: 'partner',
      entityId: id,
      after: { name: existing.name },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(PARTNERS_PATH, `Partneri kustutamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(PARTNERS_PATH)
  redirectWithNotice(PARTNERS_PATH, 'Partner kustutatud.')
}
