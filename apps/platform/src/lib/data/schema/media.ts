import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { contentStatuses } from './content'
import { inList } from './shared'

export const media = sqliteTable(
  'media',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    filename: text('filename').notNull(),
    mimeType: text('mime_type'),
    filesize: integer('filesize'),
    width: integer('width'),
    height: integer('height'),
    alt: text('alt'),
    // Bytes live in R2 (upload.disableLocalStorage); the hook stores the key
    // and public URL instead of a local path.
    r2Key: text('r2_key'),
    url: text('url'),
    // TEXT-JSON MediaRenditionsJson (src/lib/media/renditions.ts): pending
    // marker at upload, variant list after the queue consumer runs.
    renditions: text('renditions'),
    status: text('status', { enum: contentStatuses }).notNull().default('draft'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('media_r2_key_idx').on(t.r2Key),
    check('media_status_check', sql`${t.status} IN ${sql.raw(inList(contentStatuses))}`),
  ],
)
