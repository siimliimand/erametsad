

import type { BidRow } from './BidsTab'
import type { ContractRow } from './ContractsTab'
import type { IdentityTabUser, SessionRow } from './IdentityTab'
import type { NotificationRow } from './NotificationsTab'
import type { AuctionRightRow } from './RightsTab'
import { suspensionFromAudit } from './userTabHelpers'
import type { SuspensionInfo } from './userTabHelpers'
import type { DataTabId } from './userTabs'
import { maskIsikukood } from '../../../../_lib/labels'

import { listUserSessions } from '@/lib/auth/session'
import type {
  AuditEntryDoc,
  CoreRepositories,
  ProfileDoc,
  UserDoc,
} from '@/lib/data/repositories'

export type UserTabPayload =
  | { tab: 'identiteet'; user: IdentityTabUser; sessions: SessionRow[]; suspension: SuspensionInfo }
  | { tab: 'profiilid'; profiles: ProfileDoc[] }
  | {
      tab: 'oigused'
      userId: string
      rights: AuctionRightRow[]
      granterNames: Record<string, string>
      auditEntries: AuditEntryDoc[]
    }
  | { tab: 'lepingud'; contracts: ContractRow[] }
  | { tab: 'pakkumised'; bids: BidRow[] }
  | { tab: 'teavitused'; notifications: NotificationRow[] }

export interface UserTabResult {
  canWrite: boolean
  payload: UserTabPayload
}

function toIdentityTabUser(user: UserDoc): IdentityTabUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    phone: user.phone ?? null,
    role: user.role,
    status: user.status,
    authMethod: user.authMethod,
    createdAt: user.createdAt,
    isikukoodMasked: maskIsikukood(user.isikukood),
  }
}

// Rights + suspension audit trail; also feeds the identity suspension banner
// for suspended users.
async function fetchRightsAuditEntries(
  repositories: CoreRepositories,
  userId: string,
): Promise<AuditEntryDoc[]> {
  return (
    await repositories.find({
      collection: 'audit-entry',
      where: {
        and: [
          { entityType: { equals: 'user' } },
          { entityId: { equals: userId } },
          {
            action: {
              in: ['user.right_grant', 'user.right_revoke', 'user.suspend', 'user.ban'],
            },
          },
        ],
      },
      sort: '-createdAt',
      pagination: false,
      limit: 200,
    })
  ).docs
}

/**
 * One data path for the shared user tabs: the detail page calls this with its
 * own guard result, the drawer reaches it through the loadUserTabData server
 * action. Returns null only when the user row has vanished mid-session.
 */
export async function fetchUserTabPayload(
  repositories: CoreRepositories,
  userId: string,
  tab: DataTabId,
): Promise<UserTabPayload | null> {
  switch (tab) {
    case 'identiteet': {
      const user = await repositories.findByID({ collection: 'users', id: userId })
      if (!user) return null
      const [sessions, auditEntries] = await Promise.all([
        listUserSessions(userId),
        user.status === 'suspended' ? fetchRightsAuditEntries(repositories, userId) : Promise.resolve([]),
      ])
      return {
        tab,
        user: toIdentityTabUser(user),
        sessions: sessions.map(
          (sessionInfo): SessionRow => ({
            id: sessionInfo.sessionId,
            sessionId: sessionInfo.sessionId,
            createdAt: sessionInfo.createdAt.toISOString(),
            userId,
          }),
        ),
        suspension: suspensionFromAudit(auditEntries),
      }
    }

    case 'profiilid': {
      const { docs: profiles } = await repositories.find({
        collection: 'profile',
        where: { user: { equals: userId } },
        sort: '-createdAt',
        pagination: false,
      })
      return { tab, profiles }
    }

    case 'oigused': {
      const auditEntries = await fetchRightsAuditEntries(repositories, userId)
      const { docs: rights } = await repositories.find({
        collection: 'auction-rights',
        where: { user: { equals: userId } },
        sort: '-grantedAt',
        pagination: false,
      })
      const granterIds = [...new Set(rights.map((right) => right.grantedBy))]
      const granters =
        granterIds.length > 0
          ? (
              await repositories.find({
                collection: 'users',
                where: { id: { in: granterIds } },
                pagination: false,
              })
            ).docs
          : []
      const granterNames: Record<string, string> = {}
      for (const granter of granters) {
        granterNames[granter.id] = granter.name ?? granter.email
      }
      return { tab, userId, rights, granterNames, auditEntries }
    }

    case 'lepingud': {
      const { docs: contracts } = await repositories.find({
        collection: 'contracts',
        where: { signedBy: { equals: userId } },
        sort: '-createdAt',
        pagination: false,
      })
      const lotIds = [...new Set(contracts.map((contract) => contract.lotId))]
      const lots =
        lotIds.length > 0
          ? (
              await repositories.find({
                collection: 'auctions',
                where: { id: { in: lotIds } },
                pagination: false,
              })
            ).docs
          : []
      const lotTitles = new Map(lots.map((lot) => [lot.id, lot.title]))
      return {
        tab,
        contracts: contracts.map(
          (contract): ContractRow => ({
            id: contract.id,
            auctionId: contract.lotId,
            auctionTitle: lotTitles.get(contract.lotId) ?? contract.lotId,
            status: contract.status,
            createdAt: contract.createdAt,
            signedAt: contract.signedAt,
          }),
        ),
      }
    }

    case 'pakkumised': {
      const { docs: bids } = await repositories.find({
        collection: 'bids',
        where: { user: { equals: userId } },
        sort: '-createdAt',
        limit: 100,
      })
      const auctionIds = [...new Set(bids.map((bid) => bid.auctionId))]
      const auctions =
        auctionIds.length > 0
          ? (
              await repositories.find({
                collection: 'auctions',
                where: { id: { in: auctionIds } },
                pagination: false,
              })
            ).docs
          : []
      const auctionTitles = new Map(auctions.map((auction) => [auction.id, auction.title]))
      return {
        tab,
        bids: bids.map(
          (bid): BidRow => ({
            id: bid.id,
            auctionId: bid.auctionId,
            auctionTitle: auctionTitles.get(bid.auctionId) ?? bid.auctionId,
            amount: bid.amountCents,
            status: bid.status,
            source: bid.source,
            createdAt: bid.createdAt,
          }),
        ),
      }
    }

    case 'teavitused': {
      const { docs: notifications } = await repositories.find({
        collection: 'notifications',
        where: { user: { equals: userId } },
        sort: '-createdAt',
        pagination: false,
        limit: 100,
      })
      return {
        tab,
        notifications: notifications.map(
          (notification): NotificationRow => ({
            id: notification.id,
            title: notification.title,
            body: notification.body,
            event: notification.event,
            channel: notification.channel,
            readAt: notification.readAt,
            createdAt: notification.createdAt,
          }),
        ),
      }
    }
  }
}
