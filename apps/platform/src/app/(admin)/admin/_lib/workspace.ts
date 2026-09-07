import {
  auctionScope,
  can,
  leadScope,
  type AuctionScope,
  type LeadScope,
  type StaffRole,
} from '../../_lib/permissions'

import type { CoreRepositories } from '@/lib/data/repositories'
import { centsToEuros } from '@/lib/data/repositories/money'
import type { WhereClause } from '@/lib/data/repositories/where'
import { getRepositories } from '@/lib/data/runtime'
import type { Bid } from '@/lib/data/schema'

/**
 * Data layer for the Töölaud page (01 demo). Pure aggregation functions take
 * plain row slices so tests can feed fixtures; `getWorkspaceData` is the one
 * orchestrating fetcher the page calls. All counts run on system-context
 * repositories — request-level guards would hide rows an operational view
 * needs (rights-request has no user-context rule at all), so role scoping is
 * applied explicitly here via auctionScope/leadScope/can, mirroring the rail
 * badge counts in the admin layout.
 */

const DAY_MS = 86_400_000

/** Demo KPI 2 subline: "Lõpevad täna" means a 24-hour lookahead window. */
export const ENDING_TODAY_WINDOW_MS = DAY_MS

/** Same fetch ceilings the bid monitor and auctions list pages use. */
const RECENT_BID_FETCH_LIMIT = 5000
const RECENT_LEAD_FETCH_LIMIT = 50
export const RECENT_LEAD_LIMIT = 3

/** Success fee: 3% + VAT by default, per-auction override via feeOverridePercent. */
export const SUCCESS_FEE_PERCENT_DEFAULT = 3
export const VAT_PERCENT = 22

export const workspaceKpiLabels = {
  activeAuctions: 'Aktiivsed oksjonid',
  endingToday: 'Lõpevad täna',
  bidsToday: 'Pakkumisi täna',
  pendingApprovals: 'Ootel kinnitamisel',
  newLeads: 'Uued juhtlõimed',
  pendingSignature: 'Allkiri ootel',
  serviceFeeMonth: 'Teenustasu kuu jooksul',
} as const

/** Static KPI sublines; dynamic ones are built by the *Subline helpers below. */
export const workspaceKpiSublabels = {
  endingToday: '24h jooksul',
  newLeads: 'täna käsitlemata',
  pendingSignature: 'saadetud lepingud',
  serviceFeeMonth: 'prognoos',
} as const

export const workspaceKpiHrefs = {
  activeAuctions: '/admin/auctions',
  endingToday: '/admin/auctions',
  bidsToday: '/admin/bids',
  pendingApprovals: '/admin/companies',
  newLeads: '/admin/leads',
  pendingSignature: '/admin/contracts',
  serviceFeeMonth: '/admin/statistics',
} as const

export const workspaceCardLabels = {
  endingToday: 'Lõpevad täna',
  systemHealth: 'Süsteemi tervis',
  quickActions: 'Kiire tegevus',
  recentLeads: 'Viimased juhtlõimed',
  live: 'Reaalajas',
  viewAll: 'Vaata kõiki →',
} as const

export const quickActionLabels = {
  companyRequests: {
    title: 'Ettevõtte taotlused ootel',
    note: 'uued taotlused kinnitamisel',
  },
  underbids: { title: 'Alapakkumised ootel', note: 'vajab otsust' },
  contractsSigning: {
    title: 'Lepingud allkirjastamisel',
    note: 'saadetud allkirja ootama',
  },
} as const

/** Minimal row shapes the pure aggregations read; repository docs satisfy them. */
export interface WorkspaceAuctionSlice {
  id: string
  title: string
  status: string
  type: string
  objectType: string
  endsAt: string | null
  completedAt: string | null
  finalPriceCents: number | null
  feeOverridePercent: number | null
  specialistId: string | null
  sellerId: string | null
}

export interface WorkspaceBidSlice {
  id: string
  auctionId: string
  amountCents: number
  type: string
  status: string
  createdAt: string
}

export interface WorkspaceLeadSlice {
  id: string
  contactName: string
  formName: string
  source: string | null
  createdAt: string
}

export interface WorkspaceContractSlice {
  status: string
}

export interface EndingAuctionSlice extends WorkspaceAuctionSlice {
  endsAt: string
}

export interface EndingTodayRow {
  id: string
  title: string
  objectType: string
  /** 'open' | 'sealed' */
  type: string
  endsAt: string
  /** Open auctions: highest bid so far; null when no bids yet. */
  currentBidCents: number | null
  /** Sealed auctions: number of sealed bids (no amounts before the ceremony). */
  sealedBidCount: number | null
}

export interface RecentLeadRow {
  id: string
  createdAt: string
  contactName: string
  formName: string
  source: string | null
}

export interface QuickActionRow {
  key: 'company-requests' | 'underbids' | 'contracts-signing'
  title: string
  note: string | null
  count: number
  countLabel: string
  href: string
}

export interface WorkspaceKpis {
  /** null = module hidden for the role; the UI skips those cards. */
  activeAuctions: { count: number; scheduledCount: number } | null
  endingToday: { count: number } | null
  bidsToday: {
    count: number
    yesterdayCount: number
    changePercent: number | null
  } | null
  pendingApprovals: {
    companies: number | null
    underbids: number | null
  } | null
  newLeads: { count: number } | null
  pendingSignature: { count: number } | null
  serviceFeeMonth: { cents: number; eur: number } | null
}

/** The five rail-badge queues (layout task 1.7), same filters, role-gated. */
export interface WorkspaceQueues {
  companyApprovals: number | null
  rightsRequests: number | null
  newLeads: number | null
  newServiceRequests: number | null
  sealedAwaitingCeremony: number | null
}

export interface WorkspaceData {
  kpis: WorkspaceKpis
  endingToday: EndingTodayRow[]
  queues: WorkspaceQueues
  quickActions: QuickActionRow[]
  recentLeads: RecentLeadRow[]
}

export interface WorkspaceSession {
  userId: string
  role: StaffRole
}

function etCount(count: number, singular: string, partitive: string): string {
  return `${String(count)} ${count === 1 ? singular : partitive}`
}

export function scheduledAuctionsSubline(count: number): string | null {
  return count > 0 ? `+${String(count)} planeeritud` : null
}

export function bidTrendSubline(changePercent: number | null): string | null {
  if (changePercent === null) return null
  const sign = changePercent > 0 ? '+' : ''
  return `${sign}${String(changePercent)}% vs eile`
}

export function approvalSplitSubline(
  companies: number | null,
  underbids: number | null,
): string | null {
  const parts: string[] = []
  if (companies !== null)
    parts.push(etCount(companies, 'ettevõte', 'ettevõtet'))
  if (underbids !== null)
    parts.push(etCount(underbids, 'alapakkumine', 'alapakkumist'))
  return parts.length > 0 ? parts.join(' · ') : null
}

export function underbidPendingNote(oldestDays: number | null): string {
  if (oldestDays === null) return quickActionLabels.underbids.note
  return `${quickActionLabels.underbids.note} · vanim ${etCount(oldestDays, 'päev', 'päeva')}`
}

export function newRequestsCountLabel(count: number): string {
  return `${String(count)} uut`
}

export function sentContractsCountLabel(count: number): string {
  return `${String(count)} saadetud`
}

export function startOfDayMs(now: number): number {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function startOfMonthMs(now: number): number {
  const date = new Date(now)
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** Translates the permission-layer scope into a repository where clause. */
export function auctionScopeWhere(
  scope: AuctionScope,
): WhereClause | undefined {
  switch (scope.kind) {
    case 'all':
      return undefined
    case 'assigned-specialist':
      return { specialist: { equals: scope.specialistId } }
    case 'own-seller':
      return { seller: { equals: scope.sellerId } }
  }
}

export function leadScopeWhere(scope: LeadScope): WhereClause | undefined {
  switch (scope.kind) {
    case 'all':
      return undefined
    case 'assigned-specialist':
      return { assignedSpecialist: { equals: scope.assignedSpecialistId } }
    case 'none':
      return { id: { equals: '' } }
  }
}

export function countByStatus(
  rows: readonly { status: string }[],
  status: string,
): number {
  return rows.reduce(
    (total, row) => (row.status === status ? total + 1 : total),
    0,
  )
}

export function isEndingWithin(
  endsAt: string | null,
  now: number,
  windowMs: number,
): boolean {
  if (!endsAt) return false
  const time = Date.parse(endsAt)
  if (Number.isNaN(time)) return false
  const delta = time - now
  return delta >= 0 && delta <= windowMs
}

/** Active auctions ending inside the window, soonest first. */
export function endingTodayAuctions(
  auctions: readonly WorkspaceAuctionSlice[],
  now: number,
  windowMs: number = ENDING_TODAY_WINDOW_MS,
): EndingAuctionSlice[] {
  return auctions
    .filter(
      (auction): auction is EndingAuctionSlice =>
        auction.status === 'active' &&
        isEndingWithin(auction.endsAt, now, windowMs),
    )
    .sort((a, b) => (a.endsAt < b.endsAt ? -1 : a.endsAt > b.endsAt ? 1 : 0))
}

/** Sealed auctions past their end time that still await the opening ceremony. */
export function sealedAwaitingCeremony(
  auctions: readonly WorkspaceAuctionSlice[],
): WorkspaceAuctionSlice[] {
  return auctions.filter(
    (auction) => auction.type === 'sealed' && auction.status === 'ended',
  )
}

export function bidsSince(
  bids: readonly WorkspaceBidSlice[],
  fromMs: number,
): WorkspaceBidSlice[] {
  return bids.filter((bid) => {
    const time = Date.parse(bid.createdAt)
    return !Number.isNaN(time) && time >= fromMs
  })
}

export function bidsTodayCounts(
  bids: readonly WorkspaceBidSlice[],
  now: number,
): { today: number; yesterday: number } {
  const dayStart = startOfDayMs(now)
  let today = 0
  let yesterday = 0
  for (const bid of bids) {
    const time = Date.parse(bid.createdAt)
    if (Number.isNaN(time)) continue
    if (time >= dayStart) today += 1
    else if (time >= dayStart - DAY_MS) yesterday += 1
  }
  return { today, yesterday }
}

/** Trend percentage vs yesterday; null when there is no yesterday baseline. */
export function bidTrendChangePercent(
  today: number,
  yesterday: number,
): number | null {
  if (yesterday <= 0) return null
  return Math.round(((today - yesterday) / yesterday) * 100)
}

export function oldestPendingUnderbidDays(
  bids: readonly WorkspaceBidSlice[],
  now: number,
): number | null {
  let oldest: number | null = null
  for (const bid of bids) {
    if (bid.status !== 'pending_approval') continue
    const time = Date.parse(bid.createdAt)
    if (Number.isNaN(time)) continue
    const days = Math.max(0, Math.floor((now - time) / DAY_MS))
    if (oldest === null || days > oldest) oldest = days
  }
  return oldest
}

export function successFeeCents(
  finalPriceCents: number,
  feeOverridePercent: number | null,
): number {
  const percent = feeOverridePercent ?? SUCCESS_FEE_PERCENT_DEFAULT
  return Math.round((finalPriceCents * percent * (100 + VAT_PERCENT)) / 10_000)
}

/** Live-table revenue KPI: completed lots this month, never snapshot tables. */
export function monthServiceFeeCents(
  auctions: readonly WorkspaceAuctionSlice[],
  now: number,
): number {
  const monthStart = startOfMonthMs(now)
  return auctions.reduce((total, auction) => {
    if (auction.status !== 'completed' && auction.status !== 'archived')
      return total
    if (auction.finalPriceCents === null || auction.finalPriceCents <= 0)
      return total
    const completedAt = auction.completedAt
      ? Date.parse(auction.completedAt)
      : Number.NaN
    if (
      Number.isNaN(completedAt) ||
      completedAt < monthStart ||
      completedAt > now
    )
      return total
    return (
      total +
      successFeeCents(auction.finalPriceCents, auction.feeOverridePercent)
    )
  }, 0)
}

export function endingTodayRows(
  auctions: readonly WorkspaceAuctionSlice[],
  bids: readonly WorkspaceBidSlice[],
  now: number,
): EndingTodayRow[] {
  const bidsByAuction = new Map<string, WorkspaceBidSlice[]>()
  for (const bid of bids) {
    const list = bidsByAuction.get(bid.auctionId)
    if (list) list.push(bid)
    else bidsByAuction.set(bid.auctionId, [bid])
  }
  return endingTodayAuctions(auctions, now).map((auction) => {
    const auctionBids = bidsByAuction.get(auction.id) ?? []
    const highestBid = auctionBids.reduce(
      (max, bid) => Math.max(max, bid.amountCents),
      0,
    )
    return {
      id: auction.id,
      title: auction.title,
      objectType: auction.objectType,
      type: auction.type,
      endsAt: auction.endsAt,
      currentBidCents:
        auction.type === 'sealed' || highestBid <= 0 ? null : highestBid,
      sealedBidCount: auction.type === 'sealed' ? auctionBids.length : null,
    }
  })
}

export function recentLeadRows(
  leads: readonly WorkspaceLeadSlice[],
  limit: number = RECENT_LEAD_LIMIT,
): RecentLeadRow[] {
  return leads.slice(0, limit).map((lead) => ({
    id: lead.id,
    createdAt: lead.createdAt,
    contactName: lead.contactName,
    formName: lead.formName,
    source: lead.source,
  }))
}

export interface WorkspaceKpiInput {
  role: StaffRole
  now: number
  auctions: readonly WorkspaceAuctionSlice[]
  bids: readonly WorkspaceBidSlice[]
  pendingUnderbids: readonly WorkspaceBidSlice[]
  newLeadCount: number
  contracts: readonly WorkspaceContractSlice[]
  companyApprovalCount: number
}

export function buildWorkspaceKpis(input: WorkspaceKpiInput): WorkspaceKpis {
  const { role, now, auctions, bids, pendingUnderbids, contracts } = input
  const kpis: WorkspaceKpis = {
    activeAuctions: null,
    endingToday: null,
    bidsToday: null,
    pendingApprovals: null,
    newLeads: null,
    pendingSignature: null,
    serviceFeeMonth: null,
  }
  if (can(role, 'auctions:read')) {
    kpis.activeAuctions = {
      count: countByStatus(auctions, 'active'),
      scheduledCount: countByStatus(auctions, 'scheduled'),
    }
    kpis.endingToday = { count: endingTodayAuctions(auctions, now).length }
  }
  if (can(role, 'bids:read')) {
    const { today, yesterday } = bidsTodayCounts(bids, now)
    kpis.bidsToday = {
      count: today,
      yesterdayCount: yesterday,
      changePercent: bidTrendChangePercent(today, yesterday),
    }
  }
  const companies = can(role, 'companies:read')
    ? input.companyApprovalCount
    : null
  const underbids = can(role, 'bids:read')
    ? countByStatus(pendingUnderbids, 'pending_approval')
    : null
  if (companies !== null || underbids !== null) {
    kpis.pendingApprovals = { companies, underbids }
  }
  if (can(role, 'leads:read')) {
    kpis.newLeads = { count: input.newLeadCount }
  }
  if (can(role, 'contracts:read')) {
    kpis.pendingSignature = { count: countByStatus(contracts, 'sent') }
  }
  if (can(role, 'statistics:read')) {
    const cents = monthServiceFeeCents(auctions, now)
    kpis.serviceFeeMonth = { cents, eur: centsToEuros(cents) }
  }
  return kpis
}

export interface WorkspaceQueueInput {
  role: StaffRole
  auctions: readonly WorkspaceAuctionSlice[]
  newLeadCount: number
  companyApprovalCount: number
  rightsRequestCount: number
  newServiceRequestCount: number
}

export function buildWorkspaceQueues(
  input: WorkspaceQueueInput,
): WorkspaceQueues {
  const { role } = input
  return {
    companyApprovals: can(role, 'companies:read')
      ? input.companyApprovalCount
      : null,
    rightsRequests: can(role, 'users:read') ? input.rightsRequestCount : null,
    newLeads: can(role, 'leads:read') ? input.newLeadCount : null,
    newServiceRequests: can(role, 'inquiries:read')
      ? input.newServiceRequestCount
      : null,
    sealedAwaitingCeremony: can(role, 'sealed:read')
      ? sealedAwaitingCeremony(input.auctions).length
      : null,
  }
}

export interface WorkspaceQuickActionInput {
  role: StaffRole
  now: number
  pendingUnderbids: readonly WorkspaceBidSlice[]
  companyApprovalCount: number
  sentContractCount: number
}

export function buildQuickActions(
  input: WorkspaceQuickActionInput,
): QuickActionRow[] {
  const { role } = input
  const rows: QuickActionRow[] = []
  if (can(role, 'companies:read')) {
    rows.push({
      key: 'company-requests',
      title: quickActionLabels.companyRequests.title,
      note: quickActionLabels.companyRequests.note,
      count: input.companyApprovalCount,
      countLabel: newRequestsCountLabel(input.companyApprovalCount),
      href: workspaceKpiHrefs.pendingApprovals,
    })
  }
  if (can(role, 'bids:read')) {
    const count = countByStatus(input.pendingUnderbids, 'pending_approval')
    rows.push({
      key: 'underbids',
      title: quickActionLabels.underbids.title,
      note: underbidPendingNote(
        oldestPendingUnderbidDays(input.pendingUnderbids, input.now),
      ),
      count,
      countLabel: String(count),
      href: workspaceKpiHrefs.bidsToday,
    })
  }
  if (can(role, 'contracts:read')) {
    rows.push({
      key: 'contracts-signing',
      title: quickActionLabels.contractsSigning.title,
      note: quickActionLabels.contractsSigning.note,
      count: input.sentContractCount,
      countLabel: sentContractsCountLabel(input.sentContractCount),
      href: workspaceKpiHrefs.pendingSignature,
    })
  }
  return rows
}

const emptyBids: Bid[] = []

/**
 * One fetcher for the Töölaud page. Reads run as system context with role
 * scoping applied explicitly; the caller must have authenticated through
 * requireAdminRepositories first.
 */
export async function getWorkspaceData(
  session: WorkspaceSession,
): Promise<WorkspaceData> {
  const { role, userId } = session
  const repositories: CoreRepositories = await getRepositories()
  const now = Date.now()

  // exactOptionalPropertyTypes: the scope where joins only when defined.
  const auctionWhere = auctionScopeWhere(auctionScope(role, userId))
  const leadWhere = leadScopeWhere(leadScope(role, userId))
  // The new-lead queue count must match the rail badge exactly (all in-scope
  // rows), while the recent-leads list only needs the newest few.
  const newLeadWhere =
    leadWhere !== undefined
      ? { and: [leadWhere, { status: { equals: 'new' } }] }
      : ({ status: { equals: 'new' } } as const)

  const [
    auctionDocs,
    pendingBidDocs,
    recentLeadDocs,
    newLeadDocs,
    sentContractDocs,
    companyDocs,
    rightsDocs,
    serviceDocs,
    recentBidDocs,
  ] = await Promise.all([
    repositories.find({
      collection: 'auctions',
      ...(auctionWhere !== undefined ? { where: auctionWhere } : {}),
      pagination: false,
    }),
    repositories.find({
      collection: 'bids',
      where: { status: { equals: 'pending_approval' } },
      sort: 'createdAt',
      pagination: false,
    }),
    repositories.find({
      collection: 'leads',
      ...(leadWhere !== undefined ? { where: leadWhere } : {}),
      sort: '-createdAt',
      limit: RECENT_LEAD_FETCH_LIMIT,
    }),
    repositories.find({
      collection: 'leads',
      where: newLeadWhere,
      pagination: false,
    }),
    repositories.find({
      collection: 'contracts',
      where: { status: { equals: 'sent' } },
      pagination: false,
    }),
    repositories.find({
      collection: 'company-access-request',
      where: { status: { equals: 'pending' } },
      pagination: false,
    }),
    repositories.find({
      collection: 'rights-request',
      where: { status: { equals: 'pending' } },
      pagination: false,
    }),
    repositories.find({
      collection: 'service-requests',
      where: { status: { equals: 'new' } },
      pagination: false,
    }),
    can(role, 'bids:read')
      ? repositories.find({
          collection: 'bids',
          sort: '-createdAt',
          limit: RECENT_BID_FETCH_LIMIT,
        })
      : Promise.resolve({ docs: emptyBids }),
  ])

  const auctions: WorkspaceAuctionSlice[] = auctionDocs.docs
  const auctionsById = new Map(auctions.map((auction) => [auction.id, auction]))
  const bidInAuctionScope = (bid: WorkspaceBidSlice) =>
    auctionsById.has(bid.auctionId)

  const pendingUnderbids: WorkspaceBidSlice[] =
    pendingBidDocs.docs.filter(bidInAuctionScope)
  const windowBids = can(role, 'bids:read')
    ? recentBidDocs.docs.filter(bidInAuctionScope)
    : emptyBids

  // The ending-today table shows each open auction's current bid, which may
  // be older than the recent-bid window, so its bids are fetched directly.
  const ending = endingTodayAuctions(auctions, now)
  const endingBidDocs =
    can(role, 'bids:read') && ending.length > 0
      ? (
          await repositories.find({
            collection: 'bids',
            where: { auction: { in: ending.map((auction) => auction.id) } },
            sort: 'createdAt',
            pagination: false,
          })
        ).docs
      : emptyBids

  const kpis = buildWorkspaceKpis({
    role,
    now,
    auctions,
    bids: bidsSince(windowBids, startOfDayMs(now) - DAY_MS),
    pendingUnderbids,
    newLeadCount: newLeadDocs.docs.length,
    contracts: sentContractDocs.docs,
    companyApprovalCount: companyDocs.docs.length,
  })
  const queues = buildWorkspaceQueues({
    role,
    auctions,
    newLeadCount: newLeadDocs.docs.length,
    companyApprovalCount: companyDocs.docs.length,
    rightsRequestCount: rightsDocs.docs.length,
    newServiceRequestCount: serviceDocs.docs.length,
  })

  return {
    kpis,
    endingToday: endingTodayRows(auctions, endingBidDocs, now),
    queues,
    quickActions: buildQuickActions({
      role,
      now,
      pendingUnderbids,
      companyApprovalCount: companyDocs.docs.length,
      sentContractCount: sentContractDocs.docs.length,
    }),
    recentLeads: recentLeadRows(recentLeadDocs.docs),
  }
}
