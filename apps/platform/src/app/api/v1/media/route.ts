import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { can, isStaffRole } from '@/app/(admin)/_lib/permissions'
import {
  buildR2Key,
  getMediaBucket,
  getMediaQueue,
  initialRenditionsFor,
  isEditorImageMimeType,
  mediaUrlFor,
  validateEditorAttachmentUpload,
  validateEditorImageUpload,
  type MediaR2Bucket,
} from '@/app/(admin)/admin/media/_lib/media-upload'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { getRepositories, sessionGuardContext } from '@/lib/data/runtime'

export const dynamic = 'force-dynamic'

/**
 * Wizard upload endpoint (design D6, spec admin-auction-management): stores
 * an editor image (JPEG/PNG/WebP ≤ 15 MB) or PDF attachment (≤ 25 MB) in the
 * R2 BUCKET binding, records the media row the lot editor references, and
 * enqueues the media-renditions job for images. Replaces URL pasting in the
 * lot editor's media step; the media-library action (`_actions/media.ts`)
 * keeps its own redirect-based flow.
 *
 * Auth mirrors the admin API routes: staff session required, and the write
 * follows the `auctions:write` permission so sellers cannot upload.
 */

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: 'Sisselogimine on vajalik.' },
    { status: 401 },
  )
}

function readDimension(formData: FormData, key: string): number | undefined {
  const raw = formData.get(key)
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

export async function POST(request: NextRequest): Promise<Response> {
  const token = (await cookies()).get('access_token')?.value
  const payload = token ? verifyAccessToken(token) : null
  if (!payload || !isStaffRole(payload.role)) return unauthorized()
  if (!can(payload.role, 'auctions:write')) {
    return NextResponse.json(
      { error: 'Teil puudub õigus faile üles laadida.' },
      { status: 403 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: 'Kutses puudub korrektne failivorm.' },
      { status: 400 },
    )
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: 'Vali üleslaaditav fail.' },
      { status: 400 },
    )
  }

  // Editor pipeline rules (docs 03 step 5): JPEG/PNG/WebP images and PDF
  // attachments, each with its own size cap. The min-width rule runs on the
  // client, which is the only side that can decode the image.
  const width = readDimension(formData, 'width')
  const height = readDimension(formData, 'height')
  const validationError = isEditorImageMimeType(file.type)
    ? validateEditorImageUpload({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        ...(width !== undefined ? { width } : {}),
      })
    : validateEditorAttachmentUpload({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      })
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422 })
  }

  const bucket: MediaR2Bucket | null = await getMediaBucket()
  if (!bucket) {
    return NextResponse.json(
      { error: 'R2 salvestusruum pole saadaval.' },
      { status: 503 },
    )
  }

  const repositories = await getRepositories(sessionGuardContext(payload))
  const id = crypto.randomUUID()
  const key = buildR2Key(id, file.name)
  const buffer = await file.arrayBuffer()

  try {
    await bucket.put(key, buffer, { httpMetadata: { contentType: file.type } })
  } catch (error) {
    return NextResponse.json(
      { error: `Üleslaadimine ebaõnnestus: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    )
  }

  const altRaw = formData.get('alt')
  const alt = typeof altRaw === 'string' && altRaw.trim() !== '' ? altRaw.trim() : null

  try {
    await repositories.create({
      collection: 'media',
      data: {
        id,
        filename: file.name,
        mimeType: file.type,
        filesize: file.size,
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        alt,
        r2Key: key,
        url: mediaUrlFor(id),
        renditions: initialRenditionsFor(file.type),
        status: 'published',
      },
    })
  } catch (error) {
    try {
      // An R2 object without a database row is unreachable garbage.
      await bucket.delete(key)
    } catch {
      // The primary failure is what the admin needs to see.
    }
    return NextResponse.json(
      { error: `Üleslaadimine ebaõnnestus: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    )
  }

  // Renditions ride the erametsad-jobs queue; a failed enqueue keeps the
  // row's `pending` marker (same recovery rule as the media library action).
  if (initialRenditionsFor(file.type)) {
    const queue = await getMediaQueue()
    if (queue) {
      try {
        await queue.send({
          type: 'media-renditions',
          mediaId: id,
          dedupeKey: `media-renditions:${id}`,
        })
      } catch (error) {
        console.error(`[media] rendition enqueue failed for ${id}`, error)
      }
    } else {
      console.error(`[media] QUEUE binding unavailable; renditions for ${id} stay pending`)
    }
  }

  return NextResponse.json(
    {
      id,
      url: mediaUrlFor(id),
      filename: file.name,
      mimeType: file.type,
      filesize: file.size,
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
    },
    { status: 201 },
  )
}
