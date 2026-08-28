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
export * from './articles'
export * from './content'
export * from './counties'
export * from './faq-categories'
export * from './faq-items'
export * from './legal-documents'
export * from './media'
export * from './pages'
export * from './parishes'
export * from './partner-services'
export * from './redirects'
export * from './specialists'
export * from './statistics-snapshots'
export * from './testimonials'

import type { articles as articlesTable } from './articles'
import type { auctionRights as auctionRightsTable } from './auction-rights'
import type { auctionSubscriptions as auctionSubscriptionsTable } from './auction-subscriptions'
import type { auctions as auctionsTable } from './auctions'
import type { auditEntries as auditEntriesTable } from './audit-entries'
import type { autobidders as autobiddersTable } from './autobidders'
import type { bids as bidsTable } from './bids'
import type { companyAccessRequests as companyAccessRequestsTable } from './company-access-requests'
import type { contractTemplates as contractTemplatesTable } from './contract-templates'
import type { contracts as contractsTable } from './contracts'
import type { counties as countiesTable } from './counties'
import type { faqCategories as faqCategoriesTable } from './faq-categories'
import type { faqItems as faqItemsTable } from './faq-items'
import type { leads as leadsTable } from './leads'
import type { legalDocuments as legalDocumentsTable } from './legal-documents'
import type { media as mediaTable } from './media'
import type { notifications as notificationsTable } from './notifications'
import type { pages as pagesTable } from './pages'
import type { parishes as parishesTable } from './parishes'
import type { partnerServices as partnerServicesTable } from './partner-services'
import type { profiles as profilesTable } from './profiles'
import type { redirects as redirectsTable } from './redirects'
import type { settings as settingsTable } from './settings'
import type { specialists as specialistsTable } from './specialists'
import type { statisticsSnapshots as statisticsSnapshotsTable } from './statistics-snapshots'
import type { testimonials as testimonialsTable } from './testimonials'
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
export type Article = InferSelectModel<typeof articlesTable>
export type NewArticle = InferInsertModel<typeof articlesTable>
export type County = InferSelectModel<typeof countiesTable>
export type NewCounty = InferInsertModel<typeof countiesTable>
export type FaqCategory = InferSelectModel<typeof faqCategoriesTable>
export type NewFaqCategory = InferInsertModel<typeof faqCategoriesTable>
export type FaqItem = InferSelectModel<typeof faqItemsTable>
export type NewFaqItem = InferInsertModel<typeof faqItemsTable>
export type LegalDocument = InferSelectModel<typeof legalDocumentsTable>
export type NewLegalDocument = InferInsertModel<typeof legalDocumentsTable>
// Named MediaAsset, not Media: the bare name collides too easily at import
// sites (next/image, CSS media types), same reasoning as NotificationRow.
export type MediaAsset = InferSelectModel<typeof mediaTable>
export type NewMediaAsset = InferInsertModel<typeof mediaTable>
export type Page = InferSelectModel<typeof pagesTable>
export type NewPage = InferInsertModel<typeof pagesTable>
export type Parish = InferSelectModel<typeof parishesTable>
export type NewParish = InferInsertModel<typeof parishesTable>
export type PartnerService = InferSelectModel<typeof partnerServicesTable>
export type NewPartnerService = InferInsertModel<typeof partnerServicesTable>
export type Redirect = InferSelectModel<typeof redirectsTable>
export type NewRedirect = InferInsertModel<typeof redirectsTable>
export type Specialist = InferSelectModel<typeof specialistsTable>
export type NewSpecialist = InferInsertModel<typeof specialistsTable>
export type StatisticsSnapshot = InferSelectModel<typeof statisticsSnapshotsTable>
export type NewStatisticsSnapshot = InferInsertModel<typeof statisticsSnapshotsTable>
export type Testimonial = InferSelectModel<typeof testimonialsTable>
export type NewTestimonial = InferInsertModel<typeof testimonialsTable>
