'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'

import { getUserSession, revokeSession } from '@/lib/auth/session'
import { auctionObjectTypes, userRoles, userStatuses } from '@/lib/data/schema'

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?viga=${encodeURIComponent(message)}`)
}

export async function updateUserAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError('/admin/users', 'Kasutaja identifikaator puudub.')

  const editPath = `/admin/users/${id}`
  const role = readText(formData, 'role')
  const status = readText(formData, 'status')

  if (!userRoles.includes(role as (typeof userRoles)[number]) || role === 'guest') {
    redirectWithError(editPath, 'Vali sobiv roll.')
  }
  if (!userStatuses.includes(status as (typeof userStatuses)[number])) {
    redirectWithError(editPath, 'Vali sobiv olek.')
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'users',
      id,
      data: {
        role,
        status,
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
  redirect('/admin/users')
}

export async function grantAuctionRightAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const userId = readText(formData, 'userId')
  const objectType = readText(formData, 'objectType')
  const editPath = `/admin/users/${userId}`

  if (!userId) redirectWithError('/admin/users', 'Kasutaja identifikaator puudub.')
  if (!auctionObjectTypes.includes(objectType as (typeof auctionObjectTypes)[number])) {
    redirectWithError(editPath, 'Vali sobiv objekti tüüp.')
  }

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
  try {
    await repositories.create({
      collection: 'auction-rights',
      data: {
        user: userId,
        objectType,
        grantedBy: session.userId,
        grantedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(editPath, `Oksjoniõiguse andmine ebaõnnestus: ${failure}`)
  }

  revalidatePath(editPath)
  redirect(editPath)
}

export async function revokeAuctionRightAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const rightId = readText(formData, 'rightId')
  const userId = readText(formData, 'userId')
  const editPath = `/admin/users/${userId}`

  if (!rightId || !userId) {
    redirectWithError('/admin/users', 'Oksjoniõiguse identifikaator puudub.')
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'auction-rights',
      id: rightId,
      data: { revokedAt: new Date().toISOString() },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(editPath, `Oksjoniõiguse tühistamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(editPath)
  redirect(editPath)
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
