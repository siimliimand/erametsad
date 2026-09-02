/* eslint-disable no-console */
import { encryptSealedData } from '../../encryption'
import { eurosToCents, type AuctionDoc, type CoreRepositories } from '../repositories'

const OBJECT_TYPES = ['raieoigus', 'kinnistu', 'kiire', 'pakett'] as const

// Plaintext identity snapshots encrypted into each sealed bid; must match
// the isikukood values seeded in users.ts so the ceremony shows the demo
// identities after decryption.
const ISIKUKOOD_BY_EMAIL: Record<string, string> = {
  'guest@erametsad.ee': '10000000001',
  'private@erametsad.ee': '10000000002',
  'company@erametsad.ee': '10000000003',
}

async function seedAuctionRights(
  repos: CoreRepositories,
  bidderIds: string[],
  granterId: string,
): Promise<void> {
  const existing = await repos.find({ collection: 'auction-rights', limit: 1 })
  if (existing.docs.length > 0) {
    console.log('Auction rights already seeded, skipping')
    return
  }

  const grantedAt = new Date().toISOString()
  for (const userId of bidderIds) {
    for (const objectType of OBJECT_TYPES) {
      await repos.create({
        collection: 'auction-rights',
        data: {
          userId,
          objectType,
          grantedBy: granterId,
          grantedAt,
        },
      })
    }
  }

  console.log(
    `Seeded ${String(bidderIds.length * OBJECT_TYPES.length)} auction rights (${String(bidderIds.length)} bidders x ${String(OBJECT_TYPES.length)} object types)`,
  )
}

// Same row shape submitSealedBid writes: amount 0 at rest, the real amount
// and identity only inside the AES-256-GCM envelope.
async function createEncryptedSealedBid(
  repos: CoreRepositories,
  params: {
    auctionId: string
    userId: string
    amount: number
    identity: string
    status: 'leading' | 'outbid'
  },
): Promise<void> {
  const encryptedAmount = encryptSealedData(String(params.amount))
  const encryptedIdentity = encryptSealedData(params.identity)
  await repos.create({
    collection: 'bids',
    data: {
      auctionId: params.auctionId,
      userId: params.userId,
      amountCents: 0,
      type: 'sealed',
      source: 'manual',
      status: params.status,
      identitySnapshot: JSON.stringify({
        encrypted: encryptedAmount.encrypted,
        iv: encryptedAmount.iv,
        authTag: encryptedAmount.authTag,
        identityEncrypted: encryptedIdentity.encrypted,
        identityIv: encryptedIdentity.iv,
        identityAuthTag: encryptedIdentity.authTag,
      }),
    },
  })
}

// Repository port of the submitSealedBid validation chain and write pattern
// (lib/bidding/sealed-bid.ts): rights check, minBid check, revision cap,
// amount 0 at rest, previous non-rejected bids of the same bidder go outbid.
async function submitSealedBidViaRepositories(
  repos: CoreRepositories,
  params: {
    userId: string
    auction: AuctionDoc
    amount: number
    identity: string
  },
): Promise<void> {
  const { userId, auction, amount, identity } = params

  if (auction.status !== 'active') {
    throw new Error(`Sealed bid seed failed on ${auction.slug}: auction is not active`)
  }
  const endsAt = auction.endsAt
  if (!endsAt || new Date(endsAt) <= new Date()) {
    throw new Error(`Sealed bid seed failed on ${auction.slug}: auction has ended`)
  }

  const rightsResult = await repos.find({
    collection: 'auction-rights',
    where: {
      and: [
        { user: { equals: userId } },
        { objectType: { equals: auction.objectType } },
        { revokedAt: { exists: false } },
      ],
    },
    limit: 1,
  })
  if (rightsResult.docs.length === 0) {
    throw new Error(`Sealed bid seed failed on ${auction.slug}: no bidding right`)
  }

  if (eurosToCents(amount) < auction.minBidCents) {
    throw new Error(
      `Sealed bid seed failed on ${auction.slug}: bid must be at least ${String(auction.minBidCents / 100)} EUR`,
    )
  }

  const existingBid = await repos.find({
    collection: 'bids',
    where: {
      and: [
        { auction: { equals: auction.id } },
        { user: { equals: userId } },
        { type: { equals: 'sealed' } },
        { status: { not_equals: 'rejected' } },
      ],
    },
    limit: 100,
  })

  const settingsResult = await repos.find({ collection: 'settings', limit: 1 })
  const revisionCap =
    (settingsResult.docs[0] as { sealedRevisionCap?: number } | undefined)?.sealedRevisionCap ?? 3
  // Cap semantics: 1 original bid plus up to N revisions (N from Settings).
  if (existingBid.docs.length >= revisionCap + 1) {
    throw new Error(`Sealed bid seed failed on ${auction.slug}: revision limit exceeded`)
  }

  await createEncryptedSealedBid(repos, {
    auctionId: auction.id,
    userId,
    amount,
    identity,
    status: 'leading',
  })

  for (const doc of existingBid.docs) {
    await repos.update({
      collection: 'bids',
      id: doc.id,
      data: { status: 'outbid' },
    })
  }
}

export async function seedBids(repos: CoreRepositories): Promise<void> {
  const { docs: users } = await repos.find({ collection: 'users', limit: 15 })
  if (users.length === 0) throw new Error('No users found. Run seedUsers first.')

  const userByEmail = new Map(users.map((u) => [u.email, u] as const))
  const privateUser = userByEmail.get('private@erametsad.ee')
  const companyUser = userByEmail.get('company@erametsad.ee')
  const guestUser = userByEmail.get('guest@erametsad.ee')
  const superadminUser = userByEmail.get('superadmin@erametsad.ee')
  if (!privateUser || !companyUser || !guestUser || !superadminUser) {
    throw new Error('Required seed users not found (private, company, guest, superadmin)')
  }

  const isikukoodByUser = new Map<string, string>()
  for (const u of [guestUser, privateUser, companyUser]) {
    const isikukood = ISIKUKOOD_BY_EMAIL[u.email]
    if (!isikukood) {
      throw new Error(`No isikukood mapped for seed user ${u.email}`)
    }
    isikukoodByUser.set(u.id, isikukood)
  }

  // Rights must exist before sealed bids run: the rights check rejects
  // bidders without a grant for the auction objectType.
  await seedAuctionRights(repos, [guestUser.id, privateUser.id, companyUser.id], superadminUser.id)

  const existing = await repos.find({ collection: 'bids', limit: 1 })
  if (existing.docs.length > 0) {
    console.log('Bids already seeded, skipping')
    return
  }

  const { docs: auctions } = await repos.find({ collection: 'auctions', limit: 50 })
  if (auctions.length === 0) throw new Error('No auctions found. Run seedAuctions first.')

  const auctionBySlug = new Map(auctions.map((a) => [a.slug, a] as const))

  // ── Scenario 1: Active auction — bidding war (raieoigus-rae, minBid 3200) ──
  const rae = auctionBySlug.get('raieoigus-rae')
  if (rae) {
    const bids = [
      { user: privateUser.id, amount: 3200, source: 'manual', status: 'outbid' },
      { user: companyUser.id, amount: 3500, source: 'manual', status: 'outbid' },
      { user: privateUser.id, amount: 3800, source: 'manual', status: 'outbid' },
      { user: companyUser.id, amount: 4100, source: 'manual', status: 'outbid' },
      { user: privateUser.id, amount: 4400, source: 'manual', status: 'outbid' },
      { user: companyUser.id, amount: 4700, source: 'manual', status: 'leading' },
    ]
    for (const b of bids) {
      await repos.create({
        collection: 'bids',
        data: {
          auctionId: rae.id,
          type: 'open',
          amountCents: eurosToCents(b.amount),
          source: b.source,
          status: b.status,
          userId: b.user,
        },
      })
    }
    console.log(`  Created ${String(bids.length)} bids for auction "${rae.title}" (bidding war)`)
  }

  // ── Scenario 2: Ended open auction — clear winner (raieoigus-saku-ended, minBid 2800) ──
  const saku = auctionBySlug.get('raieoigus-saku-ended')
  if (saku) {
    const bids = [
      { user: guestUser.id, amount: 2800, source: 'manual', status: 'outbid' },
      { user: privateUser.id, amount: 3000, source: 'manual', status: 'outbid' },
      { user: guestUser.id, amount: 3200, source: 'manual', status: 'outbid' },
      { user: privateUser.id, amount: 3500, source: 'manual', status: 'won' },
    ]
    for (const b of bids) {
      await repos.create({
        collection: 'bids',
        data: {
          auctionId: saku.id,
          type: 'open',
          amountCents: eurosToCents(b.amount),
          source: b.source,
          status: b.status,
          userId: b.user,
        },
      })
    }
    console.log(`  Created ${String(bids.length)} bids for auction "${saku.title}" (clear winner)`)
  }

  // ── Scenario 3: Autobidder duel (raieoigus-rapla, minBid 4200) ──
  // Open auction only: the duel was previously seeded on kinnistu-elva, but
  // kinnistu auctions must be sealed and autobidders do not run on sealed
  // auctions, so the duel moved to an active open raieoigus auction.
  // maxAmount must exceed the seeded leading amount (7000): at the cap the
  // autobidder can never answer a manual bid (min legal bid 7400 needs
  // required 7800 <= maxAmount), and the duel demo goes inert.
  const rapla = auctionBySlug.get('raieoigus-rapla')
  if (rapla) {
    await repos.create({
      collection: 'autobidders',
      data: {
        userId: companyUser.id,
        auctionId: rapla.id,
        maxAmountCents: eurosToCents(9000),
        status: 'active',
      },
    })

    const bids = [
      { user: privateUser.id, amount: 4200, source: 'manual', status: 'outbid' },
      { user: companyUser.id, amount: 4600, source: 'autobidder', status: 'outbid' },
      { user: privateUser.id, amount: 5000, source: 'manual', status: 'outbid' },
      { user: companyUser.id, amount: 5400, source: 'autobidder', status: 'outbid' },
      { user: privateUser.id, amount: 5800, source: 'manual', status: 'outbid' },
      { user: companyUser.id, amount: 6200, source: 'autobidder', status: 'outbid' },
      { user: privateUser.id, amount: 6600, source: 'manual', status: 'outbid' },
      { user: companyUser.id, amount: 7000, source: 'autobidder', status: 'leading' },
    ]
    for (const b of bids) {
      await repos.create({
        collection: 'bids',
        data: {
          auctionId: rapla.id,
          type: 'open',
          amountCents: eurosToCents(b.amount),
          source: b.source,
          status: b.status,
          userId: b.user,
        },
      })
    }
    console.log(`  Created ${String(bids.length)} bids + 1 autobidder for auction "${rapla.title}" (autobidder duel)`)
  }

  // ── Scenario 4: Pending alapakkumine (kiire-parnu, minBid 800) ──
  const parnu = auctionBySlug.get('kiire-parnu')
  if (parnu) {
    await repos.create({
      collection: 'bids',
      data: {
        auctionId: parnu.id,
        userId: guestUser.id,
        amountCents: eurosToCents(500),
        type: 'open',
        source: 'manual',
        status: 'pending_approval',
      },
    })
    console.log(`  Created 1 pending-approval bid for auction "${parnu.title}" (alapakkumine)`)
  }

  // ── Scenario 5: Active sealed auction via the repository submission path ──
  // kinnistu-ida-viru is active, so the ported submitSealedBid chain runs
  // end to end: rights check, minBid check, revision cap, encryption with
  // auth tags. Demo amounts: guest 24000, private 25000 -> 30000 (revision),
  // company 27500.
  const idaViru = auctionBySlug.get('kinnistu-ida-viru')
  if (idaViru) {
    const submissions = [
      { userId: guestUser.id, amount: 24000 },
      { userId: privateUser.id, amount: 25000 },
      { userId: companyUser.id, amount: 27500 },
      { userId: privateUser.id, amount: 30000 },
    ]
    for (const s of submissions) {
      const identity = isikukoodByUser.get(s.userId)
      if (!identity) {
        throw new Error(`No isikukood mapped for user ${s.userId} on kinnistu-ida-viru`)
      }
      await submitSealedBidViaRepositories(repos, {
        userId: s.userId,
        auction: idaViru,
        amount: s.amount,
        identity,
      })
    }
    console.log(`  Created ${String(submissions.length)} sealed bids for auction "${idaViru.title}" via the submission path (private revised 25000 -> 30000)`)
  }

  // ── Scenario 6: Ended sealed auctions ready for the opening ceremony ──
  // Demo amounts the ceremony must decrypt (one sealed ended auction per
  // supported object type; rows sit at amount 0 with encrypted payloads):
  //   kinnistu-muhu-ended (minBid 18000): guest 18500, private 21000, company 22500 -> winner company 22500
  //   raieoigus-voru-ended (minBid 5500, reserve 7000): guest 5600, company 6900, private 6800 -> 7200 (1 revision) -> winner private 7200
  //   kiire-kehtna-ended (minBid 700, reserve 900): guest 750, company 900, private 950 -> winner private 950
  //   pakett-ida-viru-ended (minBid 9500, reserve 12000): private 11500, company 12500 -> winner company 12500
  const endedSealed: { slug: string; bids: { user: string; amount: number; status: 'leading' | 'outbid' }[] }[] = [
    {
      slug: 'kinnistu-muhu-ended',
      bids: [
        { user: guestUser.id, amount: 18500, status: 'leading' },
        { user: privateUser.id, amount: 21000, status: 'leading' },
        { user: companyUser.id, amount: 22500, status: 'leading' },
      ],
    },
    {
      slug: 'raieoigus-voru-ended',
      bids: [
        { user: guestUser.id, amount: 5600, status: 'leading' },
        { user: companyUser.id, amount: 6900, status: 'leading' },
        { user: privateUser.id, amount: 6800, status: 'outbid' },
        { user: privateUser.id, amount: 7200, status: 'leading' },
      ],
    },
    {
      slug: 'kiire-kehtna-ended',
      bids: [
        { user: guestUser.id, amount: 750, status: 'leading' },
        { user: companyUser.id, amount: 900, status: 'leading' },
        { user: privateUser.id, amount: 950, status: 'leading' },
      ],
    },
    {
      slug: 'pakett-ida-viru-ended',
      bids: [
        { user: privateUser.id, amount: 11500, status: 'leading' },
        { user: companyUser.id, amount: 12500, status: 'leading' },
      ],
    },
  ]

  for (const scenario of endedSealed) {
    const auction = auctionBySlug.get(scenario.slug)
    if (!auction) {
      console.warn(`  Skipping sealed bids for "${scenario.slug}": auction not found`)
      continue
    }
    for (const b of scenario.bids) {
      const identity = isikukoodByUser.get(b.user)
      if (!identity) {
        throw new Error(`No isikukood mapped for user ${b.user} on ${scenario.slug}`)
      }
      await createEncryptedSealedBid(repos, {
        auctionId: auction.id,
        userId: b.user,
        amount: b.amount,
        identity,
        status: b.status,
      })
    }
    console.log(`  Created ${String(scenario.bids.length)} encrypted sealed bids for auction "${auction.title}" (opening demo)`)
  }
}
