import { postgresAdapter } from '@payloadcms/db-postgres'
import { slateEditor } from '@payloadcms/richtext-slate'
import { buildConfig } from 'payload'

import { Article } from './payload/collections/Article'
import { Auction } from './payload/collections/Auction'
import { AuditEntry } from './payload/collections/AuditEntry'
import { Lead } from './payload/collections/Lead'
import { Notification } from './payload/collections/Notification'
import { CompanyAccessRequest } from './payload/collections/CompanyAccessRequest'
import { County } from './payload/collections/County'
import { FAQCategory } from './payload/collections/FAQCategory'
import { FAQItem } from './payload/collections/FAQItem'
import { LegalDocument } from './payload/collections/LegalDocument'
import { Media } from './payload/collections/Media'
import { Page } from './payload/collections/Page'
import { Parish } from './payload/collections/Parish'
import { PartnerService } from './payload/collections/PartnerService'
import { Profile } from './payload/collections/Profile'
import { Redirect } from './payload/collections/Redirect'
import { Settings } from './payload/collections/Settings'
import { Specialist } from './payload/collections/Specialist'
import { Testimonial } from './payload/collections/Testimonial'
import { Users } from './payload/collections/Users'

export default buildConfig({
  admin: {
    user: 'users',
  },
collections: [
    Users,
    Auction,
    County,
    Media,
    Parish,
    Profile,
    AuditEntry,
    Settings,
    Specialist,
    Page,
    Article,
    FAQCategory,
    FAQItem,
    Testimonial,
    PartnerService,
    Lead,
    LegalDocument,
    Notification,
    Redirect,
  ],
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