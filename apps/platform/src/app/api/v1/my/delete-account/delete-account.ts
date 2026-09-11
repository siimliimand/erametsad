import type { CoreRepositories } from '@/lib/data/repositories'

/**
 * D7 active-participation guard for self-service deletion: the endpoint
 * refuses while the caller still takes part in a live auction process.
 * The three conditions map onto what the repositories expose:
 *
 * - active bids: any of the user's bids sits on an auction whose status
 *   is 'active' (append-only rows, so presence is checked, not status);
 * - live autobidders: autobidder rows with status 'active' ('paused' and
 *   'expired' are inert);
 * - pending contracts: the user's contracts still in the 'prepared' or
 *   'sent' signing state (the same open-contract set the admin GDPR
 *   precheck uses).
 */

export interface ActiveParticipation {
  activeBids: number
  liveAutobidders: number
  pendingContracts: number
}

export function hasActiveParticipation(participation: ActiveParticipation): boolean {
  return (
    participation.activeBids > 0 ||
    participation.liveAutobidders > 0 ||
    participation.pendingContracts > 0
  )
}

export function activeParticipationMessage(participation: ActiveParticipation): string {
  const reasons: string[] = []
  if (participation.activeBids > 0) reasons.push('aktiivsed pakkumised')
  if (participation.liveAutobidders > 0) reasons.push('töötavad autobidid')
  if (participation.pendingContracts > 0) reasons.push('allkirjastamata lepingud')
  return `Kontot ei saa praegu kustutada: sul on veel ${reasons.join(', ')}.`
}

export async function findActiveParticipation(
  repos: CoreRepositories,
  userId: string,
): Promise<ActiveParticipation> {
  const [bids, autobidders, contracts] = await Promise.all([
    repos.find({
      collection: 'bids',
      where: { user: { equals: userId } },
      pagination: false,
    }),
    repos.find({
      collection: 'autobidders',
      where: {
        and: [{ user: { equals: userId } }, { status: { equals: 'active' } }],
      },
      pagination: false,
    }),
    repos.find({
      collection: 'contracts',
      where: { signedBy: { equals: userId } },
      pagination: false,
    }),
  ])

  const auctionIds = [...new Set(bids.docs.map((bid) => bid.auctionId))]
  const liveAuctionIds =
    auctionIds.length > 0
      ? new Set(
          (
            await repos.find({
              collection: 'auctions',
              where: { id: { in: auctionIds }, status: { equals: 'active' } },
              pagination: false,
            })
          ).docs.map((auction) => auction.id),
        )
      : new Set<string>()

  return {
    activeBids: bids.docs.filter((bid) => liveAuctionIds.has(bid.auctionId)).length,
    liveAutobidders: autobidders.docs.length,
    pendingContracts: contracts.docs.filter(
      (contract) => contract.status === 'prepared' || contract.status === 'sent',
    ).length,
  }
}
