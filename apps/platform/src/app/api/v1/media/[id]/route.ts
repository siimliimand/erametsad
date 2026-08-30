import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'

import type { MediaR2Bucket } from '@/app/(admin)/admin/media/_lib/media-upload'
import { publicContext } from '@/lib/data/guards'
import { getRepositories } from '@/lib/data/runtime'

/**
 * Streams a media asset from the R2 BUCKET binding. wrangler.jsonc exposes
 * no public bucket URL, so this route is the public URL recorded on every
 * media row (media-upload.ts mediaUrlFor). Media read access is `allow`
 * for every caller per the ported Payload access rules.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const repositories = await getRepositories(publicContext)

  const asset = await repositories.findByID({ collection: 'media', id })
  if (!asset?.r2Key) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const context = await getCloudflareContext({ async: true })
    const bucket: MediaR2Bucket | undefined = context.env.BUCKET
    if (!bucket) {
      return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 })
    }
    const object = await bucket.get(asset.r2Key)
    if (!object?.body) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return new Response(object.body, {
      headers: {
        'content-length': String(object.size),
        'content-type':
          asset.mimeType ?? object.httpMetadata?.contentType ?? 'application/octet-stream',
        // Bytes under an id never change, so responses are immutable.
        'cache-control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 })
  }
}
