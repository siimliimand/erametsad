import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getRepositories } from '@/lib/data/runtime'

// Email-footer unsubscribe: the token in the link is the credential, so no
// session or cookie is required. Runs unguarded and confirms success on the
// response body the footer link can display.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Tühistamise tunnus on kohustuslik' }, { status: 400 })
  }

  const repos = await getRepositories()
  const found = await repos.find({
    collection: 'auction-subscriptions',
    where: { unsubscribeToken: { equals: token } },
    limit: 1,
  })
  const subscription = found.docs[0]
  if (!subscription) {
    return NextResponse.json(
      { error: 'Tellimust ei leitud. Tunnus võib olla aegunud või juba kasutatud.' },
      { status: 404 },
    )
  }

  await repos.delete({ collection: 'auction-subscriptions', id: subscription.id })

  return NextResponse.json({ success: true, message: 'Tellimus on tühistatud' })
}
