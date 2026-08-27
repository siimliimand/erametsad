import type { CollectionBeforeChangeHook, CollectionAfterDeleteHook } from 'payload'
import { env } from '../../env'
import { createR2Storage, createStorage, type Storage } from '../../lib/storage'

function getStorage(binding: R2Bucket | undefined): Storage {
  if (binding) return createR2Storage(binding)
  return createStorage()
}

export const beforeChangeHook: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data.file || !data.filename) return data

  const binding = (req.context as Record<string, unknown>)?.['BUCKET'] as R2Bucket | undefined
  const storage = getStorage(binding)
  const fileData = data.file as { data: ArrayBuffer; mimetype: string; size: number }

  const { key, url } = await storage.upload({
    filename: data.filename,
    buffer: fileData.data,
    mimeType: fileData.mimetype,
    size: fileData.size,
  })

  return { ...data, r2Key: key, url }
}

export const afterDeleteHook: CollectionAfterDeleteHook = async ({ doc }) => {
  const r2Key = (doc as Record<string, unknown>).r2Key as string | undefined
  if (!r2Key) return

  const storage = createStorage()
  await storage.delete(r2Key)
}
