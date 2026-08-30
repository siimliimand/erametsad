import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { inList } from './shared'

export const userRoles = [
  'guest',
  'private',
  'company',
  'seller',
  'specialist',
  'admin',
  'superadmin',
] as const
export type UserRole = (typeof userRoles)[number]

export const userStatuses = ['active', 'suspended'] as const
export type UserStatus = (typeof userStatuses)[number]

export const authMethods = ['eid', 'password'] as const
export type AuthMethod = (typeof authMethods)[number]

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull(),
    name: text('name'),
    role: text('role', { enum: userRoles }).notNull().default('guest'),
    phone: text('phone'),
    status: text('status', { enum: userStatuses }).notNull().default('active'),
    authMethod: text('auth_method', { enum: authMethods }).notNull().default('password'),
    isikukoodEncrypted: text('isikukood_encrypted'),
    isikukoodIv: text('isikukood_iv'),
    isikukoodAuthTag: text('isikukood_auth_tag'),
    isikukoodHash: text('isikukood_hash'),
    // Payload auth:true internal columns; the password fallback needs them after Payload removal.
    passwordHash: text('password_hash'),
    passwordSalt: text('password_salt'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    index('users_isikukood_hash_idx').on(t.isikukoodHash),
    check('users_role_check', sql`${t.role} IN ${sql.raw(inList(userRoles))}`),
    check('users_status_check', sql`${t.status} IN ${sql.raw(inList(userStatuses))}`),
    check('users_auth_method_check', sql`${t.authMethod} IN ${sql.raw(inList(authMethods))}`),
  ],
)
