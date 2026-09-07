import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { pages } from './pages'
import { inList } from './shared'

// Block types for the admin page builder; the zod config registry per type
// arrives separately (change admin-ui-demo-parity, task 12.2).
export const pageBlockTypes = [
  'hero',
  'text',
  'cards',
  'accordion',
  'form',
  'ticker',
  'stats',
  'cta',
  'testimonials',
  'faq',
] as const
export type PageBlockType = (typeof pageBlockTypes)[number]

export const pageBlocks = sqliteTable(
  'page_blocks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id),
    type: text('type', { enum: pageBlockTypes }).notNull(),
    ordinal: integer('ordinal').notNull(),
    // Per-type block config as TEXT-JSON (json-fields pattern); null when the
    // block type needs no configuration.
    configJson: text('config_json'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    // Composite covers pageId lookups and ordered block fetches alike.
    index('page_blocks_page_ordinal_idx').on(t.pageId, t.ordinal),
    check(
      'page_blocks_type_check',
      sql`${t.type} IN ${sql.raw(inList(pageBlockTypes))}`,
    ),
  ],
)
