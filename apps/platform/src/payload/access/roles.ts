export const ROLES = [
  'guest',
  'private',
  'company',
  'seller',
  'specialist',
  'admin',
  'superadmin',
] as const

export type Role = (typeof ROLES)[number]

const ROLE_RANK: Record<Role, number> = {
  guest: 0,
  private: 1,
  company: 2,
  seller: 3,
  specialist: 4,
  admin: 5,
  superadmin: 6,
}

export function getRoleRank(role: Role): number {
  return ROLE_RANK[role]
}

export function getUserRole(role: string | null | undefined): Role {
  if (!role) return 'guest'
  if (ROLES.includes(role as Role)) return role as Role
  return 'guest'
}