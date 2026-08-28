import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

export * from './shared'
export * from './users'
export * from './profiles'
export * from './company-access-requests'
export * from './auction-rights'
export * from './auctions'
export * from './auction-subscriptions'
export * from './bids'
export * from './autobidders'
export * from './contract-templates'
export * from './contracts'
export * from './notifications'
export * from './audit-entries'
export * from './leads'
export * from './settings'

import type { auctionRights as auctionRightsTable } from './auction-rights'
import type { auctionSubscriptions as auctionSubscriptionsTable } from './auction-subscriptions'
import type { auctions as auctionsTable } from './auctions'
import type { auditEntries as auditEntriesTable } from './audit-entries'
import type { autobidders as autobiddersTable } from './autobidders'
import type { bids as bidsTable } from './bids'
import type { companyAccessRequests as companyAccessRequestsTable } from './company-access-requests'
import type { contractTemplates as contractTemplatesTable } from './contract-templates'
import type { contracts as contractsTable } from './contracts'
import type { leads as leadsTable } from './leads'
import type { notifications as notificationsTable } from './notifications'
import type { profiles as profilesTable } from './profiles'
import type { settings as settingsTable } from './settings'
import type { users as usersTable } from './users'

export type User = InferSelectModel<typeof usersTable>
export type NewUser = InferInsertModel<typeof usersTable>
export type Profile = InferSelectModel<typeof profilesTable>
export type NewProfile = InferInsertModel<typeof profilesTable>
export type CompanyAccessRequest = InferSelectModel<typeof companyAccessRequestsTable>
export type NewCompanyAccessRequest = InferInsertModel<typeof companyAccessRequestsTable>
export type AuctionRight = InferSelectModel<typeof auctionRightsTable>
export type NewAuctionRight = InferInsertModel<typeof auctionRightsTable>
export type Auction = InferSelectModel<typeof auctionsTable>
export type NewAuction = InferInsertModel<typeof auctionsTable>
export type AuctionSubscription = InferSelectModel<typeof auctionSubscriptionsTable>
export type NewAuctionSubscription = InferInsertModel<typeof auctionSubscriptionsTable>
export type Bid = InferSelectModel<typeof bidsTable>
export type NewBid = InferInsertModel<typeof bidsTable>
export type Autobidder = InferSelectModel<typeof autobiddersTable>
export type NewAutobidder = InferInsertModel<typeof autobiddersTable>
export type Contract = InferSelectModel<typeof contractsTable>
export type NewContract = InferInsertModel<typeof contractsTable>
export type ContractTemplate = InferSelectModel<typeof contractTemplatesTable>
export type NewContractTemplate = InferInsertModel<typeof contractTemplatesTable>
export type NotificationRow = InferSelectModel<typeof notificationsTable>
export type NewNotification = InferInsertModel<typeof notificationsTable>
export type AuditEntry = InferSelectModel<typeof auditEntriesTable>
export type NewAuditEntry = InferInsertModel<typeof auditEntriesTable>
export type Lead = InferSelectModel<typeof leadsTable>
export type NewLead = InferInsertModel<typeof leadsTable>
export type SettingsRow = InferSelectModel<typeof settingsTable>
export type NewSettings = InferInsertModel<typeof settingsTable>
