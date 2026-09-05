import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'

import type { MediaR2Bucket } from '@/app/(admin)/admin/media/_lib/media-upload'
import { publicContext } from '@/lib/data/guards'
import { getRepositories } from '@/lib/data/runtime'
import { isRenditionName, parseRenditions } from '@/lib/media/renditions'

/**
 * Streams a media asset from the R2 BUCKET binding. wrangler.jsonc exposes
 * no public bucket URL, so this route is the public URL recorded on every
 * media row (media-upload.ts mediaUrlFor). Media read access is `allow`
 * for every caller per the ported Payload access rules.
 *
 * `?variant=hero|gallery|thumb` streams a generated rendition when the
 * media row's renditions JSON is `ready` and the variant exists; any other
 * request falls back to the original bytes.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const repositories = await getRepositories(publicContext)

  const asset = await repositories.findByID({ collection: 'media', id })
  if (!asset?.r2Key) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let requestedVariant: string | null = null
  let variantKey: string | null = null
  let variantContentType: string | null = null
  const variantParam = new URL(request.url).searchParams.get('variant')
  if (variantParam && isRenditionName(variantParam)) {
    const renditions = parseRenditions(asset.renditions)
    const variant = renditions?.status === 'ready' ? renditions.variants?.[variantParam] : undefined
    if (variant) {
      requestedVariant = variantParam
      variantKey = variant.key
      variantContentType = variant.mimeType
    }
  }

  try {
    const context = await getCloudflareContext({ async: true })
    const bucket: MediaR2Bucket | undefined = context.env.BUCKET
    if (!bucket) {
      return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 })
    }
    const object = await bucket.get(variantKey ?? asset.r2Key)
    if (!object?.body) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const contentType = variantContentType ?? asset.mimeType ?? object.httpMetadata?.contentType
    return new Response(object.body, {
      headers: {
        'content-length': String(object.size),
        'content-type': contentType ?? 'application/octet-stream',
        // Bytes under an id never change, so responses are immutable.
        'cache-control': 'public, max-age=31536000, immutable',
        ...(requestedVariant ? { 'x-rendition-variant': requestedVariant } : {}),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 })
  }
}
