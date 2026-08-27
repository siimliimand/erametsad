import { draftMode } from 'next/headers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const collection = searchParams.get('collection')
  const id = searchParams.get('id')

  if (secret !== process.env.PAYLOAD_PREVIEW_SECRET) {
    return new NextResponse('Invalid or missing preview secret', { status: 401 })
  }

  if (!id || !collection) {
    return new NextResponse('Missing id or collection query parameter', { status: 400 })
  }

  ;(await draftMode()).enable()

  const redirectUrl = new URL(`/${collection}/${id}`, process.env.NEXT_PUBLIC_APP_URL)
  return NextResponse.redirect(redirectUrl)
}