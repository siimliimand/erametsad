import type { SQLiteTable } from 'drizzle-orm/sqlite-core'

import type {
  Auction,
  AuctionRight,
  AuctionSubscription,
  AuditEntry,
  Autobidder,
  Bid,
  CompanyAccessRequest,
  Contract,
  ContractTemplate,
  Lead,
  NewAuction,
  NewAuctionRight,
  NewAuctionSubscription,
  NewAuditEntry,
  NewAutobidder,
  NewBid,
  NewCompanyAccessRequest,
  NewContract,
  NewContractTemplate,
  NewLead,
  NewNotification,
  NewProfile,
  NewSettings,
  NewUser,
  NotificationRow,
  Profile,
  SettingsRow,
  User,
} from '../schema'
import {
  auctionRights,
  auctionSubscriptions,
  auctions,
  auditEntries,
  autobidders,
  bids,
  companyAccessRequests,
  contractTemplates,
  contracts,
  leads,
  notifications,
  profiles,
  settings,
  users,
} from '../schema'
import { UnknownCollectionError } from './errors'
import type { JsonFieldSpec } from './json-fields'

export type CoreCollectionSlug =
  | 'users'
  | 'profile'
  | 'company-access-request'
  | 'auction-rights'
  | 'auctions'
  | 'auction-subscriptions'
  | 'bids'
  | 'autobidders'
  | 'contracts'
  | 'contract-templates'
  | 'notifications'
  | 'audit-entry'
  | 'leads'
  | 'settings'

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
export const notificationsJsonFields = { payload: 'json' } as const satisfies JsonFieldSpec
export const auditEntriesJsonFields = { before: 'json', after: 'json' } as const satisfies JsonFieldSpec
export const settingsJsonFields = { featureFlags: 'json' } as const satisfies JsonFieldSpec
export const auctionSubscriptionsJsonFields = { filterJson: 'json' } as const satisfies JsonFieldSpec

type JsonDoc<T, J extends JsonFieldSpec> = Omit<T, keyof J> & {
  [K in keyof J & string]: J[K] extends 'array' ? unknown[] | null : unknown
}

type CreateData<T, J extends JsonFieldSpec = Record<string, never>> = Omit<
  T,
  keyof J | 'createdAt' | 'updatedAt'
> &
  Partial<Record<keyof J & string, unknown>>

export type UserDoc = User & { isikukood?: string | undefined }
export type AuctionDoc = JsonDoc<Auction, typeof auctionsJsonFields>
export type ContractTemplateDoc = JsonDoc<ContractTemplate, typeof contractTemplatesJsonFields>
export type NotificationDoc = JsonDoc<NotificationRow, typeof notificationsJsonFields>
export type AuditEntryDoc = JsonDoc<AuditEntry, typeof auditEntriesJsonFields>
export type SettingsDoc = JsonDoc<SettingsRow, typeof settingsJsonFields>
export type AuctionSubscriptionDoc = JsonDoc<AuctionSubscription, typeof auctionSubscriptionsJsonFields>

export type UserCreateData = CreateData<NewUser> & { isikukood?: string }
export type AuctionCreateData = CreateData<NewAuction, typeof auctionsJsonFields>
export type ContractTemplateCreateData = CreateData<NewContractTemplate, typeof contractTemplatesJsonFields>
export type NotificationCreateData = CreateData<NewNotification, typeof notificationsJsonFields>
export type AuditEntryCreateData = CreateData<NewAuditEntry, typeof auditEntriesJsonFields>
export type SettingsCreateData = CreateData<NewSettings, typeof settingsJsonFields>
export type AuctionSubscriptionCreateData = CreateData<
  NewAuctionSubscription,
  typeof auctionSubscriptionsJsonFields
>

export interface CoreCollectionDocs {
  users: UserDoc
  profile: Profile
  'company-access-request': CompanyAccessRequest
  'auction-rights': AuctionRight
  auctions: AuctionDoc
  'auction-subscriptions': AuctionSubscriptionDoc
  bids: Bid
  autobidders: Autobidder
  contracts: Contract
  'contract-templates': ContractTemplateDoc
  notifications: NotificationDoc
  'audit-entry': AuditEntryDoc
  leads: Lead
  settings: SettingsDoc
}

export interface CoreCollectionCreates {
  users: UserCreateData
  profile: CreateData<NewProfile>
  'company-access-request': CreateData<NewCompanyAccessRequest>
  'auction-rights': CreateData<NewAuctionRight>
  auctions: AuctionCreateData
  'auction-subscriptions': AuctionSubscriptionCreateData
  bids: CreateData<NewBid>
  autobidders: CreateData<NewAutobidder>
  contracts: CreateData<NewContract>
  'contract-templates': ContractTemplateCreateData
  notifications: NotificationCreateData
  'audit-entry': AuditEntryCreateData
  leads: CreateData<NewLead>
  settings: SettingsCreateData
}

export type DocFor<C extends CoreCollectionSlug> = CoreCollectionDocs[C]
export type CreateDataFor<C extends CoreCollectionSlug> = CoreCollectionCreates[C]
export type UpdateDataFor<C extends CoreCollectionSlug> = Partial<CreateDataFor<C>> & { id?: string }

interface CoreCollectionConfig {
  table: SQLiteTable
  aliases: Readonly<Record<string, string>>
  jsonFields: JsonFieldSpec
  isikukood: boolean
  templateActivation: boolean
}

export type { CoreCollectionConfig }

export const coreCollections: Readonly<Record<CoreCollectionSlug, CoreCollectionConfig>> = {
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
    jsonFields: {},
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

const collectionLookup: Readonly<Partial<Record<string, CoreCollectionConfig>>> = coreCollections

export function getCollectionConfig(collection: string): CoreCollectionConfig {
  const config = collectionLookup[collection]
  if (!config) {
    throw new UnknownCollectionError(collection)
  }
  return config
}
