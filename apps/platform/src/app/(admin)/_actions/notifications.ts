'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminRepositories } from '../_lib/admin'

import { getRepositories } from '@/lib/data/runtime'

/**
 * Marks one notification of the signed-in operator as read. Session guard
 * contexts cannot update notifications (guards.ts denies it), so the write
 * runs as system context scoped to the session user — the same pattern as
 * /api/v1/my/notifications/[id]/read. Returns true when the notification
 * counts as read afterwards.
 */
export async function markNotificationReadAction(formData: FormData): Promise<boolean> {
  const { session } = await requireAdminRepositories()

  const value = formData.get('id')
  const id = typeof value === 'string' ? value.trim() : ''
  if (!id) return false

  const repositories = await getRepositories()
  const result = await repositories.find({
    collection: 'notifications',
    where: {
      and: [{ id: { equals: id } }, { userId: { equals: session.userId } }],
    },
    limit: 1,
  })
  const doc = result.docs[0]
  if (!doc) return false

  // Idempotent: an already-read notification keeps its original readAt.
  if (doc.readAt) return true

  try {
    await repositories.update({
      collection: 'notifications',
      id,
      data: { readAt: new Date().toISOString() },
    })
  } catch {
    return false
  }

  revalidatePath('/admin', 'layout')
  return true
}
