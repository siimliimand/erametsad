'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'
import {
  buildR2Key,
  getMediaBucket,
  getMediaQueue,
  initialRenditionsFor,
  mediaUrlFor,
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
        alt: readOptionalText(formData, 'alt'),
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

  await persist(errorPath, 'Faili salvestamine ebaõnnestus: ', () =>
    repositories.update({
      collection: 'media',
      id,
      data: { filename, alt: readOptionalText(formData, 'alt') },
    }),
  )

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
