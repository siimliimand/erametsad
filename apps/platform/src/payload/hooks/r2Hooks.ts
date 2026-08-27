import type { CollectionAfterDeleteHook, CollectionBeforeChangeHook } from 'payload'

import {
  createR2Storage,
  createStorage,
  type Storage,
} from '../../lib/storage'

interface FileUpload {
  data: ArrayBuffer
  mimetype: string
  size: number
}

interface BeforeChangeData {
  file?: FileUpload | null
  filename?: string | null
  r2Key?: string | null
  url?: string | null
  [key: string]: unknown
}

function getStorage(binding: R2Bucket | undefined): Storage {
  if (binding) return createR2Storage(binding)
  return createStorage()
}

export const beforeChangeHook: CollectionBeforeChangeHook = async ({
  data,
  req,
}) => {
  const doc = data as unknown as BeforeChangeData
  if (!doc.file || !doc.filename) return data

  const context = req.context as Record<string, unknown>
  const binding = context.BUCKET as R2Bucket | undefined
  const storage = getStorage(binding)

  const result = await storage.upload({
    filename: doc.filename,
    buffer: doc.file.data,
    mimeType: doc.file.mimetype,
    size: doc.file.size,
  })

  return { ...data, r2Key: result.key, url: result.url }
}

export const afterDeleteHook: CollectionAfterDeleteHook = async ({ doc }) => {
  const record = doc as Record<string, unknown>
  const r2Key = record.r2Key as string | undefined
  if (!r2Key) return

  const storage = createStorage()
  await storage.delete(r2Key)
}