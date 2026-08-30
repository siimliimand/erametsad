import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { centsToEuros, eurosToCents } from '@/lib/data/repositories/money'
import { getRepositories, sessionGuardContext } from '@/lib/data/runtime'

// The DELETE semantics are "cancel", but the schema CHECK constraint only
// allows active/paused/expired. A status flip to 'paused' (never a row
// delete) takes the autobidder out of evaluation, so the last placed bid
// stands and no bid rows are touched.
const CANCELLED_STATUS = 'paused' as const

// The autobidder row is read and written through the caller's guard
// context: the ownRecord('user') rule both hides foreign rows (findByID
// returns null, surfaced as 404) and blocks foreign updates. The auction
// and leading-bid reads must run unguarded — bids read access is
// ownRecord('user'), so a guarded read would hide the rival leader.
function authenticate(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value
  if (!accessToken) {
    return {
      response: NextResponse.json({ error: 'Autentimata' }, { status: 401 }),
    } as const
  }

  const tokenPayload = verifyAccessToken(accessToken)
  if (!tokenPayload) {
    return {
      response: NextResponse.json(
        { error: 'Sessioon on aegunud' },
        { status: 401 },
      ),
    } as const
  }

  return { tokenPayload } as const
}

function toPublicAutobidder(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    user: row.userId,
    auction: row.auctionId,
    maxAmount: centsToEuros(row.maxAmountCents as number),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authenticate(request)
  if ('response' in auth) return auth.response
  const { tokenPayload } = auth

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Vigane päringu sisu' }, { status: 400 })
  }

  const maxAmount = body.maxAmount as number | undefined
  if (typeof maxAmount !== 'number' || !Number.isFinite(maxAmount) || maxAmount < 0) {
    return NextResponse.json(
      { error: 'maxAmount peab olema positiivne arv' },
      { status: 400 },
    )
  }

  const repos = await getRepositories(sessionGuardContext(tokenPayload))

  const autobidder = (await repos.findByID({
    collection: 'autobidders',
    id,
  })) as Record<string, unknown> | null
  if (!autobidder) {
    return NextResponse.json(
      { error: 'Automaatpakkuja ei leitud' },
      { status: 404 },
    )
  }

  const auctionId = autobidder.auctionId as string

  const systemRepos = await getRepositories()
  const auctionResult = await systemRepos.find({
    collection: 'auctions',
    where: { id: { equals: auctionId } },
    limit: 1,
  })
  const auction = auctionResult.docs[0] as Record<string, unknown> | undefined
  if (auction?.status !== 'active') {
    return NextResponse.json(
      { error: 'Oksjon ei ole enam aktiivne' },
      { status: 409 },
    )
  }

  const leadingResult = await systemRepos.find({
    collection: 'bids',
    where: {
      and: [
        { auction: { equals: auctionId } },
        { status: { equals: 'leading' } },
      ],
    },
    sort: '-amountCents',
    limit: 1,
  })
  const leadingBid = leadingResult.docs[0] as Record<string, unknown> | undefined

  // Same floor the autobidder engine uses: leading + step, or minBid when
  // nobody leads yet. Combined with the upward-only rule the smallest
  // acceptable new max is the larger of the two.
  const bidStepCents = typeof auction.bidStepCents === 'number' ? auction.bidStepCents : 0
  const auctionFloorCents = leadingBid
    ? (leadingBid.amountCents as number) + bidStepCents
    : (auction.minBidCents as number)
  const minAllowedCents = Math.max(auctionFloorCents, (autobidder.maxAmountCents as number) + 1)

  const newCents = eurosToCents(maxAmount)
  if (newCents < minAllowedCents) {
    return NextResponse.json(
      {
        error: `Uus maksimaalne summa peab olema vähemalt ${String(centsToEuros(minAllowedCents))} €`,
        minAllowed: centsToEuros(minAllowedCents),
      },
      { status: 422 },
    )
  }

  const updated = await repos.update({
    collection: 'autobidders',
    id,
    data: { maxAmountCents: newCents },
  })

  return NextResponse.json(toPublicAutobidder(updated as Record<string, unknown>))
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authenticate(request)
  if ('response' in auth) return auth.response
  const { tokenPayload } = auth

  const { id } = await params

  const repos = await getRepositories(sessionGuardContext(tokenPayload))

  const autobidder = (await repos.findByID({
    collection: 'autobidders',
    id,
  })) as Record<string, unknown> | null
  if (!autobidder) {
    return NextResponse.json(
      { error: 'Automaatpakkuja ei leitud' },
      { status: 404 },
    )
  }

  const systemRepos = await getRepositories()
  const auctionResult = await systemRepos.find({
    collection: 'auctions',
    where: { id: { equals: autobidder.auctionId as string } },
    limit: 1,
  })
  const auction = auctionResult.docs[0] as Record<string, unknown> | undefined
  if (auction?.status !== 'active') {
    return NextResponse.json(
      { error: 'Oksjon ei ole enam aktiivne' },
      { status: 409 },
    )
  }

  const cancelled = await repos.update({
    collection: 'autobidders',
    id,
    data: { status: CANCELLED_STATUS },
  })

  return NextResponse.json(toPublicAutobidder(cancelled as Record<string, unknown>))
}
