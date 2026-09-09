'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'
import {
  buildR2Key,
  focalCoordinateFrom,
  getMediaBucket,
  getMediaQueue,
  initialRenditionsFor,
  mediaUrlFor,
  validateMediaAlt,
  validateMediaUpload,
} from '../admin/media/_lib/media-upload'

const mediaPath = '/admin/media'

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function readOptionalText(formData: FormData, key: string): string | null {
  const value = readText(formData, key)
  return value.length > 0 ? value : null
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?viga=${encodeURIComponent(message)}`)
}

function mediaItemPath(id: string): string {
  return `${mediaPath}/${id}`
}

// Redirect must never run inside the try block: it throws NEXT_REDIRECT.
async function persist<T>(path: string, prefix: string, write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (error) {
    redirectWithError(path, `${prefix}${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Append-only audit write for media governance actions (task 3.6). */
async function writeMediaAudit(
  repositories: Awaited<ReturnType<typeof requireAdminRepositories>>['repositories'],
  entry: {
    actorId: string
    action: string
    entityId: string
    after: unknown
  },
): Promise<void> {
  await repositories.create({
    collection: 'audit-entry',
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: 'media',
      entityId: entry.entityId,
      after: entry.after,
    },
  })
}

/** Focal form fields → nullable 0..1 columns; out-of-range values are rejected. */
function readFocalPoint(
  formData: FormData,
  errorPath: string,
): { focalX: number | null; focalY: number | null } {
  const hasX = readText(formData, 'focalX').length > 0
  const hasY = readText(formData, 'focalY').length > 0
  const focalX = hasX ? focalCoordinateFrom(readText(formData, 'focalX')) : null
  const focalY = hasY ? focalCoordinateFrom(readText(formData, 'focalY')) : null
  if ((hasX && focalX === null) || (hasY && focalY === null)) {
    redirectWithError(errorPath, 'Fookuspunkt peab olema vahemikus 0 kuni 100 protsenti.')
  }
  return { focalX, focalY }
}

export async function uploadMediaAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const file = formData.get('file')
  if (!(file instanceof File)) {
    redirectWithError(mediaPath, 'Vali üleslaaditav fail.')
  }

  const validationError = validateMediaUpload({
    filename: file.name,
    mimeType: file.type,
    size: file.size,
  })
  if (validationError) redirectWithError(mediaPath, validationError)

  // Alt gate (task 3.6): image uploads require a non-empty alt text.
  const alt = readOptionalText(formData, 'alt')
  const altError = validateMediaAlt(file.type, alt)
  if (altError) redirectWithError(mediaPath, altError)

  const { focalX, focalY } = readFocalPoint(formData, mediaPath)

  const bucket = await getMediaBucket()
  if (!bucket) redirectWithError(mediaPath, 'R2 salvestusruum pole saadaval.')

  const id = crypto.randomUUID()
  const key = buildR2Key(id, file.name)
  const buffer = await file.arrayBuffer()

  let failure: string | null = null
  try {
    await bucket.put(key, buffer, { httpMetadata: { contentType: file.type } })
    await repositories.create({
      collection: 'media',
      data: {
        id,
        filename: file.name,
        mimeType: file.type,
        filesize: file.size,
        alt,
        focalX,
        focalY,
        r2Key: key,
        url: mediaUrlFor(id),
        renditions: initialRenditionsFor(file.type),
        status: 'published',
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
    try {
      // An R2 object without a database row is unreachable garbage.
      await bucket.delete(key)
    } catch {
      // The primary failure is what the admin needs to see.
    }
  }
  if (failure) redirectWithError(mediaPath, `Üleslaadimine ebaõnnestus: ${failure}`)

  // Rendition jobs ride the erametsad-jobs queue (design D6). The upload
  // stands on its own: a failed enqueue keeps the row's `pending` marker and
  // is recovered by re-enqueueing, never by failing the upload.
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

  revalidatePath(mediaPath)
  redirect(mediaPath)
}

export async function updateMediaAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  const errorPath = id.length > 0 ? mediaItemPath(id) : mediaPath
  const filename = readText(formData, 'filename')

  if (!id) redirectWithError(mediaPath, 'Faili identifikaator puudub.')
  if (!filename) redirectWithError(errorPath, 'Failinimi on kohustuslik.')

  const current = id
    ? await persist(errorPath, 'Faili lugemine ebaõnnestus: ', () =>
        repositories.findByID({ collection: 'media', id }),
      )
    : null
  if (!current) redirectWithError(errorPath, 'Faili ei leitud.')

  // Alt gate (task 3.6) at edit time, judged by the stored mime type.
  const alt = readOptionalText(formData, 'alt')
  const altError = validateMediaAlt(current.mimeType ?? '', alt)
  if (altError) redirectWithError(errorPath, altError)

  const { focalX, focalY } = readFocalPoint(formData, errorPath)

  await persist(errorPath, 'Faili salvestamine ebaõnnestus: ', () =>
    repositories.update({
      collection: 'media',
      id,
      data: {
        filename,
        alt,
        focalX,
        focalY,
      },
    }),
  )

  revalidatePath(mediaPath)
  revalidatePath(mediaItemPath(id))
  redirect(mediaPath)
}

/**
 * Replace-file action (task 3.6): swaps the stored R2 object while keeping
 * the media row id (and therefore its URL). The new bytes pass the same
 * validation as an upload; alt and focal survive unless the form sends new
 * values. The old object is deleted only after the new one is in place, and
 * the swap is audited (registry key media.replace).
 */
export async function replaceMediaFileAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  const errorPath = id.length > 0 ? mediaItemPath(id) : mediaPath

  if (!id) redirectWithError(mediaPath, 'Faili identifikaator puudub.')

  const file = formData.get('file')
  if (!(file instanceof File)) {
    redirectWithError(errorPath, 'Vali asendav fail.')
  }

  const validationError = validateMediaUpload({
    filename: file.name,
    mimeType: file.type,
    size: file.size,
  })
  if (validationError) redirectWithError(errorPath, validationError)

  const current = await persist(errorPath, 'Faili lugemine ebaõnnestus: ', () =>
    repositories.findByID({ collection: 'media', id }),
  )
  if (!current) redirectWithError(errorPath, 'Faili ei leitud.')

  // Alt gate: when the replacement is an image, the row must end up with a
  // non-empty alt — the provided value or the stored one qualifies.
  const alt = readOptionalText(formData, 'alt') ?? current.alt
  const altError = validateMediaAlt(file.type, alt)
  if (altError) redirectWithError(errorPath, altError)

  const focalX = readText(formData, 'focalX').length > 0
    ? focalCoordinateFrom(readText(formData, 'focalX'))
    : current.focalX
  const focalY = readText(formData, 'focalY').length > 0
    ? focalCoordinateFrom(readText(formData, 'focalY'))
    : current.focalY
  if (
    (readText(formData, 'focalX').length > 0 && focalX === null) ||
    (readText(formData, 'focalY').length > 0 && focalY === null)
  ) {
    redirectWithError(errorPath, 'Fookuspunkt peab olema vahemikus 0 kuni 100 protsenti.')
  }

  const bucket = await getMediaBucket()
  if (!bucket) redirectWithError(errorPath, 'R2 salvestusruum pole saadaval.')

  const nextKey = buildR2Key(id, file.name)
  const buffer = await file.arrayBuffer()

  let failure: string | null = null
  try {
    // Put first, row second, old object last: a mid-way failure leaves
    // either the old pair intact or a row pointing at stored bytes.
    await bucket.put(nextKey, buffer, { httpMetadata: { contentType: file.type } })
    await repositories.update({
      collection: 'media',
      id,
      data: {
        filename: file.name,
        mimeType: file.type,
        filesize: file.size,
        alt,
        focalX,
        focalY,
        r2Key: nextKey,
        url: mediaUrlFor(id),
        renditions: initialRenditionsFor(file.type),
      },
    })
    if (current.r2Key && current.r2Key !== nextKey) {
      await bucket.delete(current.r2Key)
    }
    await writeMediaAudit(repositories, {
      actorId: session.userId,
      action: 'media.replace',
      entityId: id,
      after: {
        filename: file.name,
        mimeType: file.type,
        filesize: file.size,
        previousFilename: current.filename,
        previousMimeType: current.mimeType,
        altKept: alt === current.alt,
        focalKept: focalX === current.focalX && focalY === current.focalY,
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) redirectWithError(errorPath, `Faili asendamine ebaõnnestus: ${failure}`)

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
    }
  }

  revalidatePath(mediaPath)
  revalidatePath(mediaItemPath(id))
  redirect(mediaPath)
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError(mediaPath, 'Faili identifikaator puudub.')

  const current = await persist(mediaPath, 'Faili lugemine ebaõnnestus: ', () =>
    repositories.findByID({ collection: 'media', id }),
  )
  if (!current) redirectWithError(mediaPath, 'Faili ei leitud.')

  const { r2Key } = current
  if (r2Key) {
    const bucket = await getMediaBucket()
    if (!bucket) redirectWithError(mediaPath, 'R2 salvestusruum pole saadaval.')
    // R2 delete is idempotent, so the object goes first: a failed row
    // delete can be retried, an orphaned object cannot be reached anymore.
    await persist(mediaPath, 'R2 objekti kustutamine ebaõnnestus: ', () =>
      bucket.delete(r2Key),
    )
  }

  await persist(mediaPath, 'Faili kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'media', id }),
  )

  revalidatePath(mediaPath)
  revalidatePath(mediaItemPath(id))
  redirect(mediaPath)
}
