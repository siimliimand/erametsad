// Upload rules for service-request attachments. The filename sanitizing and
// the R2 binding are shared with the admin media library; the allowed types
// and the size cap are stricter here per the service-request design spec
// (PDF/JPG/PNG, 10 MB), so they live as local constants instead of touching
// the admin module's 5 MiB media rules.

import {
  sanitizeFilename,
  type MediaR2Bucket,
} from '@/app/(admin)/admin/media/_lib/media-upload'

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

export const allowedAttachmentMimeTypes: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
]

export function isAllowedAttachmentMimeType(mimeType: string): boolean {
  return allowedAttachmentMimeTypes.includes(mimeType)
}

/** Estonian validation message, or null when the upload is acceptable. */
export function validateAttachment(input: {
  filename: string
  mimeType: string
  size: number
}): string | null {
  if (input.filename.trim().length === 0) {
    return 'Failinimi puudub.'
  }
  if (!isAllowedAttachmentMimeType(input.mimeType)) {
    return 'Lubatud on ainult PDF-, JPG- ja PNG-failid.'
  }
  if (input.size <= 0) {
    return 'Fail on tühi.'
  }
  if (input.size > MAX_ATTACHMENT_BYTES) {
    return 'Faili maksimaalne suurus on 10 MB.'
  }
  return null
}

export function buildAttachmentR2Key(id: string, filename: string): string {
  return `service-requests/${id}-${sanitizeFilename(filename)}`
}

/** Stores the file in R2 under service-requests/ and returns the object key. */
export async function storeAttachment(bucket: MediaR2Bucket, file: File): Promise<string> {
  const key = buildAttachmentR2Key(crypto.randomUUID(), file.name)
  const bytes = await file.arrayBuffer()
  await bucket.put(key, bytes, { httpMetadata: { contentType: file.type } })
  return key
}
