import type { Payload } from 'payload'

import { submitSealedBid } from '../../lib/bidding/sealed-bid'
import { encryptSealedData } from '../../lib/encryption'

const OBJECT_TYPES = ['raieoigus', 'kinnistu', 'kiire', 'pakett'] as const

// Plaintext identity snapshots encrypted into each sealed bid; must match
// the isikukood values seeded in users.ts so the ceremony shows the demo
// identities after decryption.
const ISIKUKOOD_BY_EMAIL: Record<string, string> = {
  'guest@eametsad.ee': '10000000001',
  'private@eametsad.ee': '10000000002',
  'company@eametsad.ee': '10000000003',
}

async function seedAuctionRights(
  payload: Payload,
  bidderIds: (string | number)[],
  granterId: string | number,
): Promise<void> {
  const existing = await payload.find({ collection: 'auction-rights', limit: 1 })
  if (existing.totalDocs > 0) {
    console.log('Auction rights already seeded, skipping')
    return
  }

  for (const userId of bidderIds) {
    for (const objectType of OBJECT_TYPES) {
      await payload.create({
        collection: 'auction-rights',
        data: {
          user: userId,
          objectType,
          grantedBy: granterId,
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
  payload: Payload,
  params: {
    auctionId: string | number
    userId: string | number
    amount: number
    identity: string
    status: 'leading' | 'outbid'
  },
): Promise<void> {
  const encryptedAmount = encryptSealedData(String(params.amount))
  const encryptedIdentity = encryptSealedData(params.identity)
  await payload.create({
    collection: 'bids',
    data: {
      auction: params.auctionId,
      user: params.userId,
      amount: 0,
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

export async function seedBids(payload: Payload): Promise<void> {
  const { docs: users } = await payload.find({ collection: 'users', limit: 15 })
  if (users.length === 0) throw new Error('No users found. Run seedUsers first.')

  const userByEmail = new Map(users.map((u) => [u.email as string, u]))
  const privateUser = userByEmail.get('private@eametsad.ee')
  const companyUser = userByEmail.get('company@eametsad.ee')
  const guestUser = userByEmail.get('guest@eametsad.ee')
  const superadminUser = userByEmail.get('superadmin@eametsad.ee')
  if (!privateUser || !companyUser || !guestUser || !superadminUser) {
    throw new Error('Required seed users not found (private, company, guest, superadmin)')
  }

  const isikukoodByUser = new Map<string | number, string>()
  for (const u of [guestUser, privateUser, companyUser]) {
    const isikukood = ISIKUKOOD_BY_EMAIL[u.email as string]
    if (!isikukood) {
      throw new Error(`No isikukood mapped for seed user ${String(u.email)}`)
    }
    isikukoodByUser.set(u.id, isikukood)
  }

  // Rights must exist before submitSealedBid runs, its rights check rejects
  // bidders without a grant for the auction objectType.
  await seedAuctionRights(payload, [guestUser.id, privateUser.id, companyUser.id], superadminUser.id)

  const existing = await payload.find({ collection: 'bids', limit: 1 })
  if (existing.totalDocs > 0) {
    console.log('Bids already seeded, skipping')
    return
  }

  const { docs: auctions } = await payload.find({ collection: 'auctions', limit: 50 })
  if (auctions.length === 0) throw new Error('No auctions found. Run seedAuctions first.')

  const auctionBySlug = new Map(auctions.map((a) => [a.slug as string, a]))

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
      await payload.create({
        collection: 'bids',
        data: { auction: rae.id, type: 'open', ...b },
      })
    }
    console.log(`  Created ${String(bids.length)} bids for auction "${String(rae.title)}" (bidding war)`)
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
      await payload.create({
        collection: 'bids',
        data: { auction: saku.id, type: 'open', ...b },
      })
    }
    console.log(`  Created ${String(bids.length)} bids for auction "${String(saku.title)}" (clear winner)`)
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
    await payload.create({
      collection: 'autobidders',
      data: {
        user: companyUser.id,
        auction: rapla.id,
        maxAmount: 9000,
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
      await payload.create({
        collection: 'bids',
        data: { auction: rapla.id, type: 'open', ...b },
      })
    }
    console.log(`  Created ${String(bids.length)} bids + 1 autobidder for auction "${String(rapla.title)}" (autobidder duel)`)
  }

  // ── Scenario 4: Pending alapakkumine (kiire-parnu, minBid 800) ──
  const parnu = auctionBySlug.get('kiire-parnu')
  if (parnu) {
    await payload.create({
      collection: 'bids',
      data: {
        auction: parnu.id,
        user: guestUser.id,
        amount: 500,
        type: 'open',
        source: 'manual',
        status: 'pending_approval',
      },
    })
    console.log(`  Created 1 pending-approval bid for auction "${String(parnu.title)}" (alapakkumine)`)
  }

  // ── Scenario 5: Active sealed auction via the real submission path ──
  // kinnistu-ida-viru is active, so submitSealedBid runs end to end:
  // rights check, minBid check, revision cap, encryption with auth tags.
  // Demo amounts: guest 24000, private 25000 -> 30000 (revision), company 27500.
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
        throw new Error(`No isikukood mapped for user ${String(s.userId)} on kinnistu-ida-viru`)
      }
      const result = await submitSealedBid({
        userId: String(s.userId),
        auctionId: String(idaViru.id),
        amount: s.amount,
        identitySnapshot: identity,
      })
      if (!result.success) {
        throw new Error(`Sealed bid seed failed on kinnistu-ida-viru: ${result.error}`)
      }
    }
    console.log(`  Created ${String(submissions.length)} sealed bids for auction "${String(idaViru.title)}" via submitSealedBid (private revised 25000 -> 30000)`)
  }

  // ── Scenario 6: Ended sealed auctions ready for the opening ceremony ──
  // Demo amounts the ceremony must decrypt (one sealed ended auction per
  // supported object type; rows sit at amount 0 with encrypted payloads):
  //   kinnistu-muhu-ended (minBid 18000): guest 18500, private 21000, company 22500 -> winner company 22500
  //   raieoigus-voru-ended (minBid 5500, reserve 7000): guest 5600, company 6900, private 6800 -> 7200 (1 revision) -> winner private 7200
  //   kiire-kehtna-ended (minBid 700, reserve 900): guest 750, company 900, private 950 -> winner private 950
  //   pakett-ida-viru-ended (minBid 9500, reserve 12000): private 11500, company 12500 -> winner company 12500
  const endedSealed: { slug: string; bids: { user: string | number; amount: number; status: 'leading' | 'outbid' }[] }[] = [
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
        throw new Error(`No isikukood mapped for user ${String(b.user)} on ${scenario.slug}`)
      }
      await createEncryptedSealedBid(payload, {
        auctionId: auction.id,
        userId: b.user,
        amount: b.amount,
        identity,
        status: b.status,
      })
    }
    console.log(`  Created ${String(scenario.bids.length)} encrypted sealed bids for auction "${String(auction.title)}" (opening demo)`)
  }
}
