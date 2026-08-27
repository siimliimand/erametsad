import { type Role, getRoleRank, getUserRole } from './roles'

type HasRole = { role?: string | null } | null | undefined

export function hasRole(user: HasRole, ...roles: Role[]): boolean {
  const userRole = getUserRole(user?.role ?? null)
  return roles.includes(userRole)
}

export function roleAtLeast(user: HasRole, minRole: Role): boolean {
  const userRole = getUserRole(user?.role ?? null)
  return getRoleRank(userRole) >= getRoleRank(minRole)
}

export function isAdmin(user: HasRole): boolean {
  return hasRole(user, 'admin', 'superadmin')
}