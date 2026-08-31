import type { SQLiteTable } from 'drizzle-orm/sqlite-core'

import type {
  Article,
  Auction,
  AuctionRight,
  AuctionSubscription,
  AuditEntry,
  Autobidder,
  Bid,
  CompanyAccessRequest,
  ConsentLog,
  Contract,
  ContractTemplate,
  County,
  FaqCategory,
  FaqItem,
  Lead,
  LegalDocument,
  MediaAsset,
  NewArticle,
  NewAuction,
  NewAuctionRight,
  NewAuctionSubscription,
  NewAuditEntry,
  NewAutobidder,
  NewBid,
  NewCompanyAccessRequest,
  NewConsentLog,
  NewContract,
  NewContractTemplate,
  NewCounty,
  NewFaqCategory,
  NewFaqItem,
  NewLead,
  NewLegalDocument,
  NewMediaAsset,
  NewNewsletterSubscriber,
  NewNotification,
  NewPage,
  NewParish,
  NewPartnerService,
  NewProfile,
  NewRedirect,
  NewRightsRequest,
  NewSettings,
  NewSpecialist,
  NewStatisticsSnapshot,
  NewTestimonial,
  NewUser,
  NewsletterSubscriber,
  NotificationRow,
  Page,
  Parish,
  PartnerService,
  Profile,
  Redirect,
  RightsRequest,
  SettingsRow,
  Specialist,
  StatisticsSnapshot,
  Testimonial,
  User,
} from '../schema'
import {
  articles,
  auctionRights,
  auctionSubscriptions,
  auctions,
  auditEntries,
  autobidders,
  bids,
  companyAccessRequests,
  consentLog,
  contractTemplates,
  contracts,
  counties,
  faqCategories,
  faqItems,
  leads,
  legalDocuments,
  media,
  newsletterSubscribers,
  notifications,
  pages,
  parishes,
  partnerServices,
  profiles,
  redirects,
  rightsRequests,
  settings,
  specialists,
  statisticsSnapshots,
  testimonials,
  users,
} from '../schema'
import { UnknownCollectionError } from './errors'
import type { JsonFieldSpec } from './json-fields'
import type { MoneyFieldMap } from './money'

export type CoreCollectionSlug =
  | 'users'
  | 'profile'
  | 'company-access-request'
  | 'rights-request'
  | 'auction-rights'
  | 'auctions'
  | 'auction-subscriptions'
  | 'bids'
  | 'autobidders'
  | 'contracts'
  | 'contract-templates'
  | 'notifications'
  | 'audit-entry'
  | 'consent-log'
  | 'newsletter-subscribers'
  | 'leads'
  | 'settings'

export type ContentCollectionSlug =
  | 'articles'
  | 'pages'
  | 'faq-categories'
  | 'faq-items'
  | 'testimonials'
  | 'partner-services'
  | 'legal-documents'
  | 'redirects'
  | 'specialists'
  | 'statistics-snapshots'
  | 'counties'
  | 'parishes'
  | 'media'

export type RepositorySlug = CoreCollectionSlug | ContentCollectionSlug

export const auctionsJsonFields = {
  coordinates: 'json',
  cadastres: 'array',
  registryNumbers: 'array',
  species: 'array',
  loggingTypes: 'array',
  compartments: 'array',
  notifications: 'array',
  deadlines: 'json',
  packageRows: 'json',
  packageColumns: 'array',
  media: 'array',
  files: 'array',
} as const satisfies JsonFieldSpec

export const contractTemplatesJsonFields = { placeholders: 'array' } as const satisfies JsonFieldSpec
export const profilesJsonFields = { notificationPreferences: 'json' } as const satisfies JsonFieldSpec
export const notificationsJsonFields = {
  payload: 'json',
  sendResult: 'json',
  recipientResults: 'json',
} as const satisfies JsonFieldSpec
export const auditEntriesJsonFields = { before: 'json', after: 'json' } as const satisfies JsonFieldSpec
export const consentLogJsonFields = { categories: 'json' } as const satisfies JsonFieldSpec
export const settingsJsonFields = { featureFlags: 'json' } as const satisfies JsonFieldSpec
export const auctionSubscriptionsJsonFields = { filterJson: 'json' } as const satisfies JsonFieldSpec

// Payload text hasMany on articles; blocks on pages. RichText columns
// (articles.content, faq-items.answer, legal-documents.content,
// specialists.bio) stay raw TEXT: the admin UI renders them as stored.
export const articlesJsonFields = { tags: 'array' } as const satisfies JsonFieldSpec
export const pagesJsonFields = { layout: 'json' } as const satisfies JsonFieldSpec

type JsonDoc<T, J extends JsonFieldSpec> = Omit<T, keyof J> & {
  [K in keyof J & string]: J[K] extends 'array' ? unknown[] | null : unknown
}

type CreateData<T, J extends JsonFieldSpec = Record<string, never>> = Omit<
  T,
  keyof J | 'createdAt' | 'updatedAt'
> &
  Partial<Record<keyof J & string, unknown>>

export type UserDoc = User & { isikukood?: string | undefined }
export type ProfileDoc = JsonDoc<Profile, typeof profilesJsonFields>
export type AuctionDoc = JsonDoc<Auction, typeof auctionsJsonFields>
export type ContractTemplateDoc = JsonDoc<ContractTemplate, typeof contractTemplatesJsonFields>
export type NotificationDoc = JsonDoc<NotificationRow, typeof notificationsJsonFields>
export type AuditEntryDoc = JsonDoc<AuditEntry, typeof auditEntriesJsonFields>
export type ConsentLogDoc = JsonDoc<ConsentLog, typeof consentLogJsonFields>
export type SettingsDoc = JsonDoc<SettingsRow, typeof settingsJsonFields>
export type AuctionSubscriptionDoc = JsonDoc<AuctionSubscription, typeof auctionSubscriptionsJsonFields>

export type UserCreateData = CreateData<NewUser> & { isikukood?: string }
export type AuctionCreateData = CreateData<NewAuction, typeof auctionsJsonFields>
export type ContractTemplateCreateData = CreateData<NewContractTemplate, typeof contractTemplatesJsonFields>
export type NotificationCreateData = CreateData<NewNotification, typeof notificationsJsonFields>
export type AuditEntryCreateData = CreateData<NewAuditEntry, typeof auditEntriesJsonFields>
export type ConsentLogCreateData = CreateData<NewConsentLog, typeof consentLogJsonFields>
export type SettingsCreateData = CreateData<NewSettings, typeof settingsJsonFields>
export type AuctionSubscriptionCreateData = CreateData<
  NewAuctionSubscription,
  typeof auctionSubscriptionsJsonFields
>

export type ArticleDoc = JsonDoc<Article, typeof articlesJsonFields>
export type PageDoc = JsonDoc<Page, typeof pagesJsonFields>
// Payload 'eur' number on the public surface; eur_cents integer in storage.
export type StatisticsSnapshotDoc = Omit<StatisticsSnapshot, 'eurCents'> & { eur: number }
export type StatisticsSnapshotCreateData = Omit<CreateData<NewStatisticsSnapshot>, 'eurCents'> & {
  eur: number
}

export interface CoreCollectionDocs {
  users: UserDoc
  profile: ProfileDoc
  'company-access-request': CompanyAccessRequest
  'rights-request': RightsRequest
  'auction-rights': AuctionRight
  auctions: AuctionDoc
  'auction-subscriptions': AuctionSubscriptionDoc
  bids: Bid
  autobidders: Autobidder
  contracts: Contract
  'contract-templates': ContractTemplateDoc
  notifications: NotificationDoc
  'audit-entry': AuditEntryDoc
  'consent-log': ConsentLogDoc
  'newsletter-subscribers': NewsletterSubscriber
  leads: Lead
  settings: SettingsDoc
}

export interface CoreCollectionCreates {
  users: UserCreateData
  profile: CreateData<NewProfile, typeof profilesJsonFields>
  'company-access-request': CreateData<NewCompanyAccessRequest>
  'rights-request': CreateData<NewRightsRequest>
  'auction-rights': CreateData<NewAuctionRight>
  auctions: AuctionCreateData
  'auction-subscriptions': AuctionSubscriptionCreateData
  bids: CreateData<NewBid>
  autobidders: CreateData<NewAutobidder>
  contracts: CreateData<NewContract>
  'contract-templates': ContractTemplateCreateData
  notifications: NotificationCreateData
  'audit-entry': AuditEntryCreateData
  'consent-log': ConsentLogCreateData
  'newsletter-subscribers': CreateData<NewNewsletterSubscriber>
  leads: CreateData<NewLead>
  settings: SettingsCreateData
}

export interface ContentCollectionDocs {
  articles: ArticleDoc
  pages: PageDoc
  'faq-categories': FaqCategory
  'faq-items': FaqItem
  testimonials: Testimonial
  'partner-services': PartnerService
  'legal-documents': LegalDocument
  redirects: Redirect
  specialists: Specialist
  'statistics-snapshots': StatisticsSnapshotDoc
  counties: County
  parishes: Parish
  media: MediaAsset
}

export interface ContentCollectionCreates {
  articles: CreateData<NewArticle, typeof articlesJsonFields>
  pages: CreateData<NewPage, typeof pagesJsonFields>
  'faq-categories': CreateData<NewFaqCategory>
  'faq-items': CreateData<NewFaqItem>
  testimonials: CreateData<NewTestimonial>
  'partner-services': CreateData<NewPartnerService>
  'legal-documents': CreateData<NewLegalDocument>
  redirects: CreateData<NewRedirect>
  specialists: CreateData<NewSpecialist>
  'statistics-snapshots': StatisticsSnapshotCreateData
  counties: CreateData<NewCounty>
  parishes: CreateData<NewParish>
  media: CreateData<NewMediaAsset>
}

type RepositoryDocs = CoreCollectionDocs & ContentCollectionDocs
type RepositoryCreates = CoreCollectionCreates & ContentCollectionCreates

export type DocFor<C extends RepositorySlug> = RepositoryDocs[C]
export type CreateDataFor<C extends RepositorySlug> = RepositoryCreates[C]
export type UpdateDataFor<C extends RepositorySlug> = Partial<CreateDataFor<C>> & { id?: string }

interface RepositoryCollectionConfig {
  table: SQLiteTable
  aliases: Readonly<Record<string, string>>
  jsonFields: JsonFieldSpec
  isikukood: boolean
  templateActivation: boolean
  /** Public EUR field name to stored integer-cents column. */
  moneyFields?: MoneyFieldMap
}

export type { RepositoryCollectionConfig }
export type CoreCollectionConfig = RepositoryCollectionConfig

export const coreCollections: Readonly<Record<CoreCollectionSlug, RepositoryCollectionConfig>> = {
  users: {
    table: users,
    aliases: {},
    jsonFields: {},
    isikukood: true,
    templateActivation: false,
  },
  profile: {
    table: profiles,
    aliases: { user: 'userId' },
    jsonFields: profilesJsonFields,
    isikukood: false,
    templateActivation: false,
  },
  'company-access-request': {
    table: companyAccessRequests,
    aliases: {},
    jsonFields: {},
    isikukood: false,
    templateActivation: false,
  },
  'rights-request': {
    table: rightsRequests,
    aliases: { user: 'userId' },
    jsonFields: {},
    isikukood: false,
    templateActivation: false,
  },
  'auction-rights': {
    table: auctionRights,
    aliases: { user: 'userId' },
    jsonFields: {},
    isikukood: false,
    templateActivation: false,
  },
  auctions: {
    table: auctions,
    aliases: {
      county: 'countyId',
      parish: 'parishId',
      specialist: 'specialistId',
      seller: 'sellerId',
    },
    jsonFields: auctionsJsonFields,
    isikukood: false,
    templateActivation: false,
  },
  'auction-subscriptions': {
    table: auctionSubscriptions,
    aliases: { user: 'userId' },
    jsonFields: auctionSubscriptionsJsonFields,
    isikukood: false,
    templateActivation: false,
  },
  bids: {
    table: bids,
    aliases: { auction: 'auctionId', user: 'userId' },
    jsonFields: {},
    isikukood: false,
    templateActivation: false,
  },
  autobidders: {
    table: autobidders,
    aliases: { user: 'userId', auction: 'auctionId' },
    jsonFields: {},
    isikukood: false,
    templateActivation: false,
  },
  contracts: {
    table: contracts,
    aliases: { template: 'templateId', lot: 'lotId', signedBy: 'signedBy' },
    jsonFields: {},
    isikukood: false,
    templateActivation: false,
  },
  'contract-templates': {
    table: contractTemplates,
    aliases: { docxFile: 'docxFileId' },
    jsonFields: contractTemplatesJsonFields,
    isikukood: false,
    templateActivation: true,
  },
  notifications: {
    table: notifications,
    aliases: { user: 'userId' },
    jsonFields: notificationsJsonFields,
    isikukood: false,
    templateActivation: false,
  },
  'audit-entry': {
    table: auditEntries,
    aliases: { actor: 'actorId' },
    jsonFields: auditEntriesJsonFields,
    isikukood: false,
    templateActivation: false,
  },
  'consent-log': {
    table: consentLog,
    aliases: {},
    jsonFields: consentLogJsonFields,
    isikukood: false,
    templateActivation: false,
  },
  'newsletter-subscribers': {
    table: newsletterSubscribers,
    aliases: {},
    jsonFields: {},
    isikukood: false,
    templateActivation: false,
  },
  leads: {
    table: leads,
    aliases: { assignedSpecialist: 'assignedSpecialistId' },
    jsonFields: {},
    isikukood: false,
    templateActivation: false,
  },
  settings: {
    table: settings,
    aliases: {},
    jsonFields: settingsJsonFields,
    isikukood: false,
    templateActivation: false,
  },
}

export const contentCollections: Readonly<Record<ContentCollectionSlug, RepositoryCollectionConfig>> =
  {
    articles: {
      table: articles,
      aliases: { featuredImage: 'featuredImageId' },
      jsonFields: articlesJsonFields,
      isikukood: false,
      templateActivation: false,
    },
    pages: {
      table: pages,
      aliases: {},
      jsonFields: pagesJsonFields,
      isikukood: false,
      templateActivation: false,
    },
    'faq-categories': {
      table: faqCategories,
      aliases: {},
      jsonFields: {},
      isikukood: false,
      templateActivation: false,
    },
    'faq-items': {
      table: faqItems,
      aliases: { category: 'categoryId' },
      jsonFields: {},
      isikukood: false,
      templateActivation: false,
    },
    testimonials: {
      table: testimonials,
      aliases: { avatar: 'avatarId' },
      jsonFields: {},
      isikukood: false,
      templateActivation: false,
    },
    'partner-services': {
      table: partnerServices,
      aliases: {},
      jsonFields: {},
      isikukood: false,
      templateActivation: false,
    },
    'legal-documents': {
      table: legalDocuments,
      aliases: {},
      jsonFields: {},
      isikukood: false,
      templateActivation: false,
    },
    redirects: {
      table: redirects,
      aliases: {},
      jsonFields: {},
      isikukood: false,
      templateActivation: false,
    },
    specialists: {
      table: specialists,
      aliases: { photo: 'photoId' },
      jsonFields: {},
      isikukood: false,
      templateActivation: false,
    },
    'statistics-snapshots': {
      table: statisticsSnapshots,
      aliases: {},
      jsonFields: {},
      isikukood: false,
      templateActivation: false,
      moneyFields: { eur: 'eurCents' },
    },
    counties: {
      table: counties,
      aliases: {},
      jsonFields: {},
      isikukood: false,
      templateActivation: false,
    },
    parishes: {
      table: parishes,
      aliases: { county: 'countyId' },
      jsonFields: {},
      isikukood: false,
      templateActivation: false,
    },
    media: {
      table: media,
      aliases: {},
      jsonFields: {},
      isikukood: false,
      templateActivation: false,
    },
  }

const collectionLookup: Readonly<Partial<Record<string, RepositoryCollectionConfig>>> = {
  ...coreCollections,
  ...contentCollections,
}

export function getCollectionConfig(collection: string): RepositoryCollectionConfig {
  const config = collectionLookup[collection]
  if (!config) {
    throw new UnknownCollectionError(collection)
  }
  return config
}
