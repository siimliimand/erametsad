import { postgresAdapter } from '@payloadcms/db-postgres'
import { slateEditor } from '@payloadcms/richtext-slate'
import { buildConfig } from 'payload'

import { Media } from './payload/collections/Media'
import { Users } from './payload/collections/Users'

export default buildConfig({
  admin: {
    user: 'users',
  },
  collections: [Users, Media],
  editor: slateEditor({}), // eslint-disable-line @typescript-eslint/no-deprecated
  secret: process.env.PAYLOAD_SECRET ?? '',
  typescript: {
    autoGenerate: true,
  },
  cors: [process.env.NEXT_PUBLIC_APP_URL ?? ''],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL ?? '',
    },
  }),
})
