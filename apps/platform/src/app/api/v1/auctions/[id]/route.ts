import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getAuctionDossier, viewerFromTokenPayload } from '@/lib/auction/queries'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { getRepositories } from '@/lib/data/runtime'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Guests are allowed; a present but invalid token downgrades to guest.
  const accessToken = request.cookies.get('access_token')?.value
  const viewer = viewerFromTokenPayload(
    accessToken ? verifyAccessToken(accessToken) : null,
  )

  try {
    const repos = await getRepositories()
    const dossier = await getAuctionDossier(repos, id, viewer)
    if (!dossier) {
      return NextResponse.json({ error: 'Oksjoni ei leitud' }, { status: 404 })
    }
    return NextResponse.json(dossier)
  } catch (error) {
    console.error('[auctions/detail] query failed', error)
    return NextResponse.json({ error: 'Serveri viga' }, { status: 500 })
  }
}
