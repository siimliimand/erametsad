import type { Payload } from 'payload'

export async function seedBids(payload: Payload): Promise<void> {
  const existing = await payload.find({ collection: 'bids', limit: 1 })
  if (existing.totalDocs > 0) {
    console.log('Bids already seeded, skipping')
    return
  }

  const { docs: users } = await payload.find({ collection: 'users', limit: 15 })
  if (users.length === 0) throw new Error('No users found. Run seedUsers first.')

  const userByEmail = new Map(users.map((u) => [u.email as string, u]))
  const privateUser = userByEmail.get('private@eametsad.ee')
  const companyUser = userByEmail.get('company@eametsad.ee')
  const guestUser = userByEmail.get('guest@eametsad.ee')
  if (!privateUser || !companyUser || !guestUser) {
    throw new Error('Required seed users not found (private, company, guest)')
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

  // ── Scenario 2: Ended auction — clear winner (raieoigus-saku-ended, minBid 2800) ──
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

  // ── Scenario 3: Autobidder duel (kinnistu-elva, minBid 28000) ──
  const elva = auctionBySlug.get('kinnistu-elva')
  if (elva) {
    // Create autobidder for company user
    await payload.create({
      collection: 'autobidders',
      data: {
        user: companyUser.id,
        auction: elva.id,
        maxAmount: 31000,
        status: 'active',
      },
    })

    const bids = [
      { user: privateUser.id, amount: 28000, source: 'manual', status: 'outbid' },
      { user: companyUser.id, amount: 28500, source: 'autobidder', status: 'outbid' },
      { user: privateUser.id, amount: 29000, source: 'manual', status: 'outbid' },
      { user: companyUser.id, amount: 29500, source: 'autobidder', status: 'outbid' },
      { user: privateUser.id, amount: 30000, source: 'manual', status: 'outbid' },
      { user: companyUser.id, amount: 30500, source: 'autobidder', status: 'outbid' },
      { user: privateUser.id, amount: 30800, source: 'manual', status: 'outbid' },
      { user: companyUser.id, amount: 31000, source: 'autobidder', status: 'leading' },
    ]
    for (const b of bids) {
      await payload.create({
        collection: 'bids',
        data: { auction: elva.id, type: 'open', ...b },
      })
    }
    console.log(`  Created ${String(bids.length)} bids + 1 autobidder for auction "${String(elva.title)}" (autobidder duel)`)
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

  // ── Scenario 5: Sealed bids (kinnistu-ida-viru) ──
  const idaViru = auctionBySlug.get('kinnistu-ida-viru')
  if (idaViru) {
    const sealedBids = [
      { user: privateUser.id, amount: 25000, identitySnapshot: 'ENC::dummy_encrypted_identity_1' },
      { user: companyUser.id, amount: 27500, identitySnapshot: 'ENC::dummy_encrypted_identity_2' },
      { user: guestUser.id, amount: 24000, identitySnapshot: 'ENC::dummy_encrypted_identity_3' },
      { user: privateUser.id, amount: 30000, identitySnapshot: 'ENC::dummy_encrypted_identity_4' },
    ]
    for (const b of sealedBids) {
      await payload.create({
        collection: 'bids',
        data: {
          auction: idaViru.id,
          user: b.user,
          amount: b.amount,
          type: 'sealed',
          source: 'manual',
          status: 'leading',
          identitySnapshot: b.identitySnapshot,
        },
      })
    }
    console.log(`  Created ${String(sealedBids.length)} sealed bids for auction "${String(idaViru.title)}"`)
  }
}