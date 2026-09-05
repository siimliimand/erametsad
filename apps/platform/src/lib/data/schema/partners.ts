import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const partners = sqliteTable('partners', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  serviceTypes: text('service_types').notNull(),
  // null means the partner serves every county.
  counties: text('counties'),
  capacity: integer('capacity').notNull().default(0),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
