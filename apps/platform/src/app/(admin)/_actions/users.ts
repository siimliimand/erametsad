'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'
import { can, type AdminPermission } from '../_lib/permissions'
import { isSuspendDuration, suspendedUntil } from '../admin/users/_components/suspend'

import { getUserSession, revokeSession } from '@/lib/auth/session'
import type { CoreRepositories, UserDoc } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import { auctionObjectTypes, userRoles } from '@/lib/data/schema'

const REASON_MIN_LENGTH = 5

// Enforcement actions are audited with the same `user.suspend` key in both
// directions; `after.status` distinguishes a suspension from an early end.
const AUDIT_SUSPEND = 'user.suspend'

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

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?viga=${encodeURIComponent(message)}`)
}

function redirectWithNotice(path: string, message: string): never {
  redirect(`${path}?teade=${encodeURIComponent(message)}`)
}

function assertPermissionOrRedirect(role: Parameters<typeof can>[0], permission: AdminPermission, path: string): void {
  if (!can(role, permission)) {
    redirectWithError(path, 'Teil puudub õigus selle toimingu sooritamiseks.')
  }
}

/**
 * Append-only audit write. Like the other admin modules, the write runs on
 * unguarded system repositories after the admin permission check —
 * notifications cannot be created through a staff guard context at all.
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

export async function updateUserAction(formData: FormData): Promise<void> {
  const { session } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError('/admin/users', 'Kasutaja identifikaator puudub.')

  const editPath = `/admin/users/${id}`
  assertPermissionOrRedirect(session.role, 'users:write', editPath)
  const repositories = await getRepositories()

  const role = readText(formData, 'role')
  if (!userRoles.includes(role as (typeof userRoles)[number]) || role === 'guest') {
    redirectWithError(editPath, 'Vali sobiv roll.')
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
    redirectWithError(editPath, `Kasutaja salvestamine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/users')
  revalidatePath(editPath)
  redirectWithNotice(editPath, 'Kasutaja andmed salvestatud.')
}

export async function grantAuctionRightAction(formData: FormData): Promise<void> {
  const { session } = await requireAdminRepositories()

  const userId = readText(formData, 'userId')
  const objectType = readText(formData, 'objectType')
  const reason = readText(formData, 'reason')
  const notify = readCheckbox(formData, 'notify')
  const editPath = `/admin/users/${userId}`

  if (!userId) redirectWithError('/admin/users', 'Kasutaja identifikaator puudub.')
  assertPermissionOrRedirect(session.role, 'users:write', editPath)
  if (!auctionObjectTypes.includes(objectType as (typeof auctionObjectTypes)[number])) {
    redirectWithError(editPath, 'Vali sobiv objekti tüüp.')
  }
  if (!hasMinReason(reason)) {
    redirectWithError(editPath, 'Õiguse andmise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const repositories = await getRepositories()

  const user = await repositories.findByID({ collection: 'users', id: userId })
  if (!user) redirectWithError('/admin/users', 'Kasutajat ei leitud.')

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
    redirectWithError(editPath, 'See oksjoniõigus on juba antud.')
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
    redirectWithError(editPath, `Oksjoniõiguse andmine ebaõnnestus: ${failure}`)
  }

  revalidatePath(editPath)
  redirectWithNotice(editPath, `Õigus antud${notify ? ' ja kasutajat teavitatud' : ''}.`)
}

export async function revokeAuctionRightAction(formData: FormData): Promise<void> {
  const { session } = await requireAdminRepositories()

  const rightId = readText(formData, 'rightId')
  const userId = readText(formData, 'userId')
  const reason = readText(formData, 'reason')
  const notify = readCheckbox(formData, 'notify')
  const editPath = `/admin/users/${userId}`

  if (!rightId || !userId) {
    redirectWithError('/admin/users', 'Oksjoniõiguse identifikaator puudub.')
  }
  assertPermissionOrRedirect(session.role, 'users:write', editPath)
  if (!hasMinReason(reason)) {
    redirectWithError(editPath, 'Õiguse tühistamise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const repositories = await getRepositories()

  const right = await repositories.findByID({ collection: 'auction-rights', id: rightId })
  if (right?.userId !== userId) {
    redirectWithError(editPath, 'Oksjoniõigust ei leitud või see ei kuulu sellele kasutajale.')
  }
  if (right.revokedAt !== null) {
    redirectWithError(editPath, 'See oksjoniõigus on juba tühistatud.')
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
    redirectWithError(editPath, `Oksjoniõiguse tühistamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(editPath)
  redirectWithNotice(editPath, `Õigus tühistatud${notify ? ' ja kasutajat teavitatud' : ''}.`)
}

export async function suspendUserAction(formData: FormData): Promise<void> {
  const { session } = await requireAdminRepositories()

  const userId = readText(formData, 'userId')
  const duration = readText(formData, 'duration')
  const reason = readText(formData, 'reason')
  const editPath = `/admin/users/${userId}`

  if (!userId) redirectWithError('/admin/users', 'Kasutaja identifikaator puudub.')
  assertPermissionOrRedirect(session.role, 'users:write', editPath)
  if (!isSuspendDuration(duration)) {
    redirectWithError(editPath, 'Vali peatamise kestus.')
  }
  if (!hasMinReason(reason)) {
    redirectWithError(editPath, 'Peatamise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const repositories = await getRepositories()

  const user = await repositories.findByID({ collection: 'users', id: userId })
  if (!user) redirectWithError('/admin/users', 'Kasutajat ei leitud.')
  if (user.status === 'suspended') {
    redirectWithError(editPath, 'Kasutaja konto on juba peatatud.')
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
    redirectWithError(editPath, `Kasutaja peatamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(editPath)
  revalidatePath('/admin/users')
  redirectWithNotice(editPath, 'Konto peatatud; aktiivsed automaatpakkujad deaktiveeritud ja kasutaja teavitatud.')
}

export async function resumeUserAction(formData: FormData): Promise<void> {
  const { session } = await requireAdminRepositories()

  const userId = readText(formData, 'userId')
  const reason = readText(formData, 'reason')
  const editPath = `/admin/users/${userId}`

  if (!userId) redirectWithError('/admin/users', 'Kasutaja identifikaator puudub.')
  assertPermissionOrRedirect(session.role, 'users:write', editPath)
  if (!hasMinReason(reason)) {
    redirectWithError(editPath, 'Aktiveerimise põhjus on kohustuslik (vähemalt 5 tähemärki).')
  }

  const repositories = await getRepositories()

  const user = await repositories.findByID({ collection: 'users', id: userId })
  if (!user) redirectWithError('/admin/users', 'Kasutajat ei leitud.')
  if (user.status !== 'suspended') {
    redirectWithError(editPath, 'Kasutaja konto ei ole peatatud.')
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
    redirectWithError(editPath, `Kasutaja aktiveerimine ebaõnnestus: ${failure}`)
  }

  revalidatePath(editPath)
  revalidatePath('/admin/users')
  redirectWithNotice(editPath, 'Konto aktiveeritud uuesti ja kasutajat teavitatud.')
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
    redirectWithError('/admin/users', 'Sessiooni identifikaator puudub.')
  }

  const record = await getUserSession(sessionId)
  if (record?.userId !== userId) {
    redirectWithError(editPath, 'Sessiooni ei leitud või see ei kuulu sellele kasutajale.')
  }

  let failure: string | null = null
  try {
    await revokeSession(sessionId)
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(editPath, `Sessiooni tühistamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(editPath)
  redirect(editPath)
}
