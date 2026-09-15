// Upload rules for portal object-submission files (sale wizard). Follows the
// service-request attachments module: the R2 bucket type, filename sanitizing,
// and the allowed-type list come from the admin media library, while the
// multi-file count and the 10 MB per-file cap are local constants per the
// portal proposal (max 10 files, 10 MB each).

import {
  isAllowedMimeType,
  sanitizeFilename,
  type MediaR2Bucket,
} from '@/app/(admin)/admin/media/_lib/media-upload'

export const MAX_SUBMISSION_FILES = 10

export const MAX_SUBMISSION_FILE_BYTES = 10 * 1024 * 1024

/**
 * Validates the whole batch before anything is stored: count cap, per-file
 * type/size. Returns the Estonian error message for the first violation, or
 * null when every file is acceptable.
 */
export function validateSubmissionFiles(files: readonly File[]): string | null {
  if (files.length === 0) {
    return 'Lisa vähemalt üks fail.'
  }
  if (files.length > MAX_SUBMISSION_FILES) {
    return 'Lisa kuni 10 faili.'
  }
  for (const file of files) {
    if (file.name.trim().length === 0) {
      return 'Failinimi puudub.'
    }
    if (!isAllowedMimeType(file.type)) {
      return 'Lubatud on ainult JPEG, PNG, WebP, GIF ja AVIF pildid ning PDF-failid.'
    }
    if (file.size <= 0) {
      return 'Fail on tühi.'
    }
    if (file.size > MAX_SUBMISSION_FILE_BYTES) {
      return 'Faili maksimaalne suurus on 10 MB.'
    }
  }
  return null
}

export function buildSubmissionFileR2Key(filename: string): string {
  return `object-submissions/${crypto.randomUUID()}-${sanitizeFilename(filename)}`
}

/**
 * Stores every validated file under object-submissions/ and returns the keys
 * in input order. If a put fails after earlier ones succeeded, the stored
 * objects are deleted before rethrowing so a failed batch leaves no orphans.
 */
export async function storeSubmissionFiles(
  bucket: MediaR2Bucket,
  files: readonly File[],
): Promise<string[]> {
  const stored: string[] = []
  try {
    for (const file of files) {
      const key = buildSubmissionFileR2Key(file.name)
      const bytes = await file.arrayBuffer()
      await bucket.put(key, bytes, { httpMetadata: { contentType: file.type } })
      stored.push(key)
    }
  } catch (error) {
    await Promise.allSettled(stored.map((key) => bucket.delete(key)))
    throw error
  }
  return stored
}
