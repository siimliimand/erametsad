import type { WhereClause, WhereField } from './repositories/where'

/**
 * Explicit port of the Payload collection access rules (INVENTORY.md §3,
 * source of truth `src/payload/collections/*.access.ts`). Field names in
 * rules and row filters are the public Payload names (`user`, `specialist`,
 * `status`); the repository layer resolves them to storage columns. Guards
 * are pure: they never read the database.
 */

export const GUARD_ROLES = [
  'guest',
  'private',
  'company',
  'seller',
  'specialist',
  'admin',
  'superadmin',
] as const

export type GuardRole = (typeof GUARD_ROLES)[number]

export interface GuardUser {
  id: string
  role: GuardRole
}

/** public = anonymous caller, user = authenticated caller, system = trusted server code */
export type GuardContext = { kind: 'public' } | { kind: 'user'; user: GuardUser } | { kind: 'system' }

export type GuardOperation = 'read' | 'create' | 'update' | 'delete'

export interface GuardDecision {
  allowed: boolean
  reason?: string
  /** Row filter applied to reads (Payload Where-style access result). */
  where?: WhereClause
}

export type GuardedRow = Record<string, unknown>

export const publicContext: GuardContext = { kind: 'public' }
export const systemContext: GuardContext = { kind: 'system' }

export function userContext(id: string, role: GuardRole): GuardContext {
  return { kind: 'user', user: { id, role } }
}

type GuardRule =
  | { kind: 'allow' }
  | { kind: 'deny' }
  | { kind: 'authenticated' }
  | { kind: 'admin' }
  | { kind: 'roles'; roles: GuardRole[] }
  | { kind: 'ownRecord'; field: string }
  | { kind: 'published'; statusField: string; publishedValue: string; ownField?: string }

const allow: GuardRule = { kind: 'allow' }
const deny: GuardRule = { kind: 'deny' }
const authenticated: GuardRule = { kind: 'authenticated' }
const adminOnly: GuardRule = { kind: 'admin' }

function ownRecord(field: string): GuardRule {
  return { kind: 'ownRecord', field }
}

/** Payload default access (no explicit rule): any authenticated user. */
const payloadDefault = {
  read: authenticated,
  create: authenticated,
  update: authenticated,
  delete: authenticated,
} as const

/** CMS content: public read, admin write (INVENTORY §3 CMS note). */
const publicReadAdminWrite = {
  read: allow,
  create: adminOnly,
  update: adminOnly,
  delete: adminOnly,
} as const

function normalizeRole(role: unknown): GuardRole {
  return GUARD_ROLES.includes(role as GuardRole) ? (role as GuardRole) : 'guest'
}

function isAdminRole(role: GuardRole): boolean {
  return role === 'admin' || role === 'superadmin'
}

function ctxUser(ctx: GuardContext): { user?: GuardUser; role: GuardRole } {
  if (ctx.kind === 'user') {
    return { user: ctx.user, role: normalizeRole(ctx.user.role) }
  }
  return { role: 'guest' }
}

function evaluate(rule: GuardRule, ctx: GuardContext): GuardDecision {
  const { user, role } = ctxUser(ctx)
  switch (rule.kind) {
    case 'allow':
      return { allowed: true }
    case 'deny':
      return { allowed: false, reason: 'operation is denied for every caller' }
    case 'authenticated':
      return user ? { allowed: true } : { allowed: false, reason: 'authentication required' }
    case 'admin':
      return isAdminRole(role)
        ? { allowed: true }
        : { allowed: false, reason: 'admin or superadmin role required' }
    case 'roles':
      return rule.roles.includes(role)
        ? { allowed: true }
        : { allowed: false, reason: `one of roles required: ${rule.roles.join(', ')}` }
    case 'ownRecord':
      if (isAdminRole(role)) return { allowed: true }
      if (!user) return { allowed: false, reason: 'authentication required' }
      return { allowed: true, where: { [rule.field]: { equals: user.id } } }
    case 'published': {
      if (isAdminRole(role)) return { allowed: true }
      const published = { [rule.statusField]: { equals: rule.publishedValue } }
      if (rule.ownField && role === 'specialist' && user) {
        return {
          allowed: true,
          where: { or: [{ [rule.ownField]: { equals: user.id } }, published] },
        }
      }
      return { allowed: true, where: published }
    }
  }
}

/**
 * Per-collection operation matrix. Every repository slug has all four
 * operations defined; unknown slugs or missing rules fail closed.
 */
export const GUARD_RULES: Readonly<
  Record<string, Readonly<Partial<Record<GuardOperation, GuardRule>>>>
> = {
  // users: Payload auth collection — registration and admin edits run as system context.
  users: { read: adminOnly, create: authenticated, update: authenticated, delete: authenticated },
  profile: { read: ownRecord('user'), create: allow, update: ownRecord('user'), delete: ownRecord('user') },
  'company-access-request': payloadDefault,
  'auction-rights': {
    read: ownRecord('user'),
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  auctions: {
    read: { kind: 'published', statusField: 'status', publishedValue: 'active', ownField: 'specialist' },
    create: { kind: 'roles', roles: ['admin', 'superadmin', 'specialist'] },
    update: ownRecord('specialist'),
    delete: adminOnly,
  },
  'auction-subscriptions': {
    create: authenticated,
    read: ownRecord('user'),
    update: ownRecord('user'),
    delete: ownRecord('user'),
  },
  bids: {
    create: authenticated,
    read: ownRecord('user'),
    update: adminOnly,
    delete: deny,
  },
  autobidders: {
    create: authenticated,
    read: ownRecord('user'),
    update: ownRecord('user'),
    delete: ownRecord('user'),
  },
  contracts: { create: adminOnly, read: authenticated, update: adminOnly, delete: adminOnly },
  'contract-templates': { create: adminOnly, read: allow, update: adminOnly, delete: adminOnly },
  notifications: { create: deny, read: ownRecord('user'), update: deny, delete: deny },
  'audit-entry': { read: adminOnly, create: adminOnly, update: adminOnly, delete: adminOnly },
  leads: { read: adminOnly, create: adminOnly, update: adminOnly, delete: adminOnly },
  settings: payloadDefault,
  'statistics-snapshots': publicReadAdminWrite,
  media: { read: allow, create: authenticated, update: authenticated, delete: authenticated },
  articles: publicReadAdminWrite,
  pages: publicReadAdminWrite,
  'faq-categories': publicReadAdminWrite,
  'faq-items': publicReadAdminWrite,
  testimonials: publicReadAdminWrite,
  'partner-services': publicReadAdminWrite,
  'legal-documents': publicReadAdminWrite,
  redirects: publicReadAdminWrite,
  specialists: publicReadAdminWrite,
  counties: publicReadAdminWrite,
  parishes: publicReadAdminWrite,
}

/**
 * Evaluate one access rule. When `row` is provided, a Where-style decision
 * is matched against that row (row-level check for update/delete/findByID).
 */
export function can(
  ctx: GuardContext,
  collection: string,
  operation: GuardOperation,
  row?: GuardedRow,
): GuardDecision {
  if (ctx.kind === 'system') return { allowed: true }
  const rule = GUARD_RULES[collection]?.[operation]
  if (!rule) {
    return { allowed: false, reason: `no ${operation} rule for '${collection}'; access denied` }
  }
  const decision = evaluate(rule, ctx)
  if (decision.allowed && decision.where && row !== undefined) {
    return matchesWhere(row, decision.where)
      ? { allowed: true }
      : { allowed: false, reason: 'row does not satisfy the access filter' }
  }
  return decision
}

function isComparablePrimitive(value: unknown): value is string | number | bigint | boolean {
  const type = typeof value
  return type === 'string' || type === 'number' || type === 'bigint' || type === 'boolean'
}

function looseEquals(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true
  if (isComparablePrimitive(actual) && isComparablePrimitive(expected)) {
    return String(actual) === String(expected)
  }
  return false
}

function matchesField(actual: unknown, condition: WhereField): boolean {
  if ('equals' in condition) return looseEquals(actual, condition.equals)
  if ('not_equals' in condition) return !looseEquals(actual, condition.not_equals)
  if ('exists' in condition) {
    const present = actual !== null && actual !== undefined
    return condition.exists ? present : !present
  }
  if ('in' in condition) return [...condition.in].some((value) => looseEquals(actual, value))
  if ('less_than_equal' in condition) {
    return actual !== null && actual !== undefined && Number(actual) <= Number(condition.less_than_equal)
  }
  return false
}

function isWhereAnd(where: WhereClause): where is { and: readonly WhereClause[] } {
  return Array.isArray((where as { and?: unknown }).and)
}

function isWhereOr(where: WhereClause): where is { or: readonly WhereClause[] } {
  return Array.isArray((where as { or?: unknown }).or)
}

/** Pure in-row evaluation of a WhereClause (the inventoried operator set). */
export function matchesWhere(row: GuardedRow, where: WhereClause): boolean {
  if (isWhereAnd(where)) {
    return where.and.every((clause) => matchesWhere(row, clause))
  }
  if (isWhereOr(where)) {
    return where.or.some((clause) => matchesWhere(row, clause))
  }
  let result = true
  for (const [field, condition] of Object.entries(where)) {
    result = result && condition !== undefined && matchesField(row[field], condition)
  }
  return result
}
