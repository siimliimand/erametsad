/**
 * Role-permission layer for the admin (design D1). The sidebar/module map
 * only hides modules; every page and action must re-check permissions
 * server-side via `can`/`assertCan` and scope its queries with
 * `auctionScope`/`leadScope`.
 */

export type StaffRole = 'admin' | 'superadmin' | 'specialist' | 'seller'

export const staffRoles: readonly StaffRole[] = [
  'admin',
  'superadmin',
  'specialist',
  'seller',
]

export function isStaffRole(role: string): role is StaffRole {
  return (staffRoles as readonly string[]).includes(role)
}

/**
 * Every server-side checkable admin permission. Read permissions gate the
 * module (list) views; the `auctions:*` operation permissions cover the
 * governance writes that the spec denies to staff roles.
 */
export type AdminPermission =
  | 'workspace:view'
  | 'auctions:read'
  | 'auctions:write'
  | 'auctions:end-manual'
  | 'auctions:archive'
  | 'auctions:export'
  | 'auctions:fee-override'
  | 'auctions:reassign-specialist'
  | 'bids:read'
  | 'bids:write'
  | 'underbids:decide'
  | 'sealed:read'
  | 'sealed:operate'
  | 'leads:read'
  | 'leads:write'
  | 'inquiries:read'
  | 'inquiries:write'
  | 'users:read'
  | 'users:write'
  | 'companies:read'
  | 'companies:write'
  | 'contracts:read'
  | 'contracts:write'
  | 'content:read'
  | 'content:write'
  | 'statistics:read'
  | 'settings:read'
  | 'settings:write'
  | 'audit:read'

export const adminPermissions: readonly AdminPermission[] = [
  'workspace:view',
  'auctions:read',
  'auctions:write',
  'auctions:end-manual',
  'auctions:archive',
  'auctions:export',
  'auctions:fee-override',
  'auctions:reassign-specialist',
  'bids:read',
  'bids:write',
  'underbids:decide',
  'sealed:read',
  'sealed:operate',
  'leads:read',
  'leads:write',
  'inquiries:read',
  'inquiries:write',
  'users:read',
  'users:write',
  'companies:read',
  'companies:write',
  'contracts:read',
  'contracts:write',
  'content:read',
  'content:write',
  'statistics:read',
  'settings:read',
  'settings:write',
  'audit:read',
]

const ADMIN_ALLOWED: readonly AdminPermission[] = [...adminPermissions]

const SPECIALIST_ALLOWED: readonly AdminPermission[] = [
  'workspace:view',
  'auctions:read',
  'auctions:write',
  'bids:read',
  'bids:write',
  'underbids:decide',
  'leads:read',
  'leads:write',
  'inquiries:read',
  'inquiries:write',
  'statistics:read',
]

// Spec deny-list for the specialist role, then the governance modules the
// role cannot reach at all.
const SPECIALIST_DENIED: readonly AdminPermission[] = [
  'auctions:end-manual',
  'auctions:archive',
  'auctions:export',
  'auctions:fee-override',
  'auctions:reassign-specialist',
  'sealed:read',
  'sealed:operate',
  'users:read',
  'users:write',
  'companies:read',
  'companies:write',
  'contracts:read',
  'contracts:write',
  'content:read',
  'content:write',
  'settings:read',
  'settings:write',
  'audit:read',
]

// Seller is read-only plus alapakkumine decisions on its own lots
// (scoping via auctionScope); everything else is denied.
const SELLER_ALLOWED: readonly AdminPermission[] = [
  'workspace:view',
  'auctions:read',
  'bids:read',
  'underbids:decide',
]

const SELLER_DENIED: readonly AdminPermission[] = [
  'auctions:write',
  'auctions:end-manual',
  'auctions:archive',
  'auctions:export',
  'auctions:fee-override',
  'auctions:reassign-specialist',
  'bids:write',
  'sealed:read',
  'sealed:operate',
  'leads:read',
  'leads:write',
  'inquiries:read',
  'inquiries:write',
  'users:read',
  'users:write',
  'companies:read',
  'companies:write',
  'contracts:read',
  'contracts:write',
  'content:read',
  'content:write',
  'statistics:read',
  'settings:read',
  'settings:write',
  'audit:read',
]

export const ROLE_ALLOWED_PERMISSIONS: Record<StaffRole, ReadonlySet<AdminPermission>> = {
  admin: new Set(ADMIN_ALLOWED),
  superadmin: new Set(ADMIN_ALLOWED),
  specialist: new Set(SPECIALIST_ALLOWED),
  seller: new Set(SELLER_ALLOWED),
}

export const ROLE_DENIED_PERMISSIONS: Record<StaffRole, ReadonlySet<AdminPermission>> = {
  admin: new Set(),
  superadmin: new Set(),
  specialist: new Set(SPECIALIST_DENIED),
  seller: new Set(SELLER_DENIED),
}

/**
 * Deny overrides allow: a permission is granted only when the role's allow
 * list has it and its deny list does not.
 */
export function can(role: StaffRole, permission: AdminPermission): boolean {
  return ROLE_ALLOWED_PERMISSIONS[role].has(permission) && !ROLE_DENIED_PERMISSIONS[role].has(permission)
}

export class PermissionDeniedError extends Error {
  readonly permission: AdminPermission

  constructor(permission: AdminPermission) {
    super('Teil puudub õigus selle toimingu sooritamiseks.')
    this.name = 'PermissionDeniedError'
    this.permission = permission
  }
}

/** Throws an explicit error for rejected writes; never a silent no-op. */
export function assertCan(role: StaffRole, permission: AdminPermission): void {
  if (!can(role, permission)) {
    throw new PermissionDeniedError(permission)
  }
}

export type AuctionScope =
  | { kind: 'all' }
  | { kind: 'assigned-specialist'; specialistId: string }
  | { kind: 'own-seller'; sellerId: string }

export type LeadScope =
  | { kind: 'all' }
  | { kind: 'assigned-specialist'; assignedSpecialistId: string }
  | { kind: 'none' }

/** Single place that describes lot row scoping per role (repository-agnostic). */
export function auctionScope(role: StaffRole, userId: string): AuctionScope {
  switch (role) {
    case 'admin':
    case 'superadmin':
      return { kind: 'all' }
    case 'specialist':
      return { kind: 'assigned-specialist', specialistId: userId }
    case 'seller':
      return { kind: 'own-seller', sellerId: userId }
  }
}

/** Single place that describes lead row scoping per role (repository-agnostic). */
export function leadScope(role: StaffRole, userId: string): LeadScope {
  switch (role) {
    case 'admin':
    case 'superadmin':
      return { kind: 'all' }
    case 'specialist':
      return { kind: 'assigned-specialist', assignedSpecialistId: userId }
    case 'seller':
      return { kind: 'none' }
  }
}

export interface AuctionRecordRef {
  specialistId?: string | null
  sellerId?: string | null
}

export function auctionInScope(scope: AuctionScope, record: AuctionRecordRef): boolean {
  switch (scope.kind) {
    case 'all':
      return true
    case 'assigned-specialist':
      return record.specialistId === scope.specialistId
    case 'own-seller':
      return record.sellerId === scope.sellerId
  }
}

export interface LeadRecordRef {
  assignedSpecialistId?: string | null
}

export function leadInScope(scope: LeadScope, record: LeadRecordRef): boolean {
  switch (scope.kind) {
    case 'all':
      return true
    case 'assigned-specialist':
      return record.assignedSpecialistId === scope.assignedSpecialistId
    case 'none':
      return false
  }
}

export type AdminModuleId =
  | 'workspace'
  | 'auctions'
  | 'bids'
  | 'sealed-opening'
  | 'users'
  | 'companies'
  | 'contracts'
  | 'leads'
  | 'inquiries'
  | 'content'
  | 'statistics'
  | 'settings'
  | 'audit-log'

export interface AdminModuleDefinition {
  id: AdminModuleId
  label: string
  href: string
}

/** The 13 admin modules in sidebar order; labels are user-facing Estonian. */
export const ADMIN_MODULES: readonly AdminModuleDefinition[] = [
  { id: 'workspace', label: 'Töölaud', href: '/admin' },
  { id: 'auctions', label: 'Oksjonid', href: '/admin/auctions' },
  { id: 'bids', label: 'Pakkumised', href: '/admin/bids' },
  { id: 'sealed-opening', label: 'Sul. avamine', href: '/admin/sealed-opening' },
  { id: 'users', label: 'Kasutajad', href: '/admin/users' },
  { id: 'companies', label: 'Ettevõtted', href: '/admin/companies' },
  { id: 'contracts', label: 'Lepingud', href: '/admin/contracts' },
  { id: 'leads', label: 'Juhtlõimed', href: '/admin/leads' },
  { id: 'inquiries', label: 'Päringud', href: '/admin/inquiries' },
  { id: 'content', label: 'Sisu', href: '/admin/content' },
  { id: 'statistics', label: 'Statistika', href: '/admin/statistics' },
  { id: 'settings', label: 'Seaded', href: '/admin/settings' },
  { id: 'audit-log', label: 'Auditlogi', href: '/admin/audit-log' },
]

const MODULE_READ_PERMISSION: Record<AdminModuleId, AdminPermission> = {
  workspace: 'workspace:view',
  auctions: 'auctions:read',
  bids: 'bids:read',
  'sealed-opening': 'sealed:read',
  users: 'users:read',
  companies: 'companies:read',
  contracts: 'contracts:read',
  leads: 'leads:read',
  inquiries: 'inquiries:read',
  content: 'content:read',
  statistics: 'statistics:read',
  settings: 'settings:read',
  'audit-log': 'audit:read',
}

function computeModuleVisibility(): Record<StaffRole, ReadonlySet<AdminModuleId>> {
  const visibility = {} as Record<StaffRole, ReadonlySet<AdminModuleId>>
  for (const role of staffRoles) {
    visibility[role] = new Set(
      ADMIN_MODULES.filter((module) => can(role, MODULE_READ_PERMISSION[module.id])).map(
        (module) => module.id,
      ),
    )
  }
  return visibility
}

/** Per-role set of visible module ids; the sidebar only hides, it never authorizes. */
export const MODULE_VISIBILITY: Record<StaffRole, ReadonlySet<AdminModuleId>> =
  computeModuleVisibility()

export function visibleModules(role: StaffRole): readonly AdminModuleDefinition[] {
  return ADMIN_MODULES.filter((module) => MODULE_VISIBILITY[role].has(module.id))
}
