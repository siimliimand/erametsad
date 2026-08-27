import type { Access, AccessResult } from 'payload'

import { isAdmin } from './guards'

export const adminOnly: Access = ({ req: { user } }) => {
  return isAdmin(user as { role?: string })
}

export const authenticated: Access = ({ req: { user } }) => {
  return !!user
}

export const publicRead: { read: Access; create: Access; update: Access; delete: Access } = {
  read: () => true,
  create: adminOnly,
  update: adminOnly,
  delete: adminOnly,
}

export function ownRecordOrAdmin(
  fieldName = 'id',
): { read: Access; update: Access; delete: Access } {
  const guard: Access = ({ req: { user } }) => {
    if (isAdmin(user as { role?: string })) return true
    if (!user) return false
    return { [fieldName]: { equals: user.id } } satisfies AccessResult
  }
  return { read: guard, update: guard, delete: guard }
}