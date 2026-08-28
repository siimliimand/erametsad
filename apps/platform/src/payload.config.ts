import { postgresAdapter } from '@payloadcms/db-postgres'
import { slateEditor } from '@payloadcms/richtext-slate'
import { buildConfig } from 'payload'

import { Article } from './payload/collections/Article'
import { Auction } from './payload/collections/Auction'
import { AuctionRight } from './payload/collections/AuctionRight'
import { AuctionSubscription } from './payload/collections/AuctionSubscription'
import { AuditEntry } from './payload/collections/AuditEntry'
import { AutoBidder } from './payload/collections/AutoBidder'
import { Bid } from './payload/collections/Bid'
import { CompanyAccessRequest } from './payload/collections/CompanyAccessRequest'
import { Contract } from './payload/collections/Contract'
import { ContractTemplate } from './payload/collections/ContractTemplate'
import { County } from './payload/collections/County'
import { FAQCategory } from './payload/collections/FAQCategory'
import { FAQItem } from './payload/collections/FAQItem'
import { Lead } from './payload/collections/Lead'
import { LegalDocument } from './payload/collections/LegalDocument'
import { Media } from './payload/collections/Media'
import { Notification } from './payload/collections/Notification'
import { Page } from './payload/collections/Page'
import { Parish } from './payload/collections/Parish'
import { PartnerService } from './payload/collections/PartnerService'
import { Profile } from './payload/collections/Profile'
import { Redirect } from './payload/collections/Redirect'
import { Settings } from './payload/collections/Settings'
import { Specialist } from './payload/collections/Specialist'
import { StatisticsSnapshot } from './payload/collections/StatisticsSnapshot'
import { Testimonial } from './payload/collections/Testimonial'
import { Users } from './payload/collections/Users'

export default buildConfig({
  admin: {
    user: 'users',
  },
collections: [
    Article,
    Auction,
    AuctionRight,
    AuctionSubscription,
    AutoBidder,
    AuditEntry,
    Bid,
    CompanyAccessRequest,
    Contract,
    ContractTemplate,
    County,
    FAQCategory,
    FAQItem,
    Lead,
    LegalDocument,
    Media,
    Notification,
    Page,
    Parish,
    PartnerService,
    Profile,
    Redirect,
    Settings,
    Specialist,
    StatisticsSnapshot,
    Testimonial,
    Users,
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