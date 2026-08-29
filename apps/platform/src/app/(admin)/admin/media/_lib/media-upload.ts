// Pure upload rules for the media library, shared by the admin server
// actions (_actions/media.ts), the media screens, and the streaming route
// at /api/v1/media/[id]. Only the pure parts are covered by vitest; R2
// itself is exercised on the worker runtime.

/** Cloudflare Email/Workers-friendly cap for a single admin upload. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export const allowedMediaMimeTypes: readonly string[] = [
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

// SVG stays out: served inline, a crafted SVG can execute script in the
// site origin, and the streaming route has no sanitizer.
export function isAllowedMimeType(mimeType: string): boolean {
  return allowedMediaMimeTypes.includes(mimeType)
}

/** ASCII-only, path-free, length-capped key segment for an R2 object key. */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? ''
  const sanitized = base
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9.-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+/, '')
    .replace(/[-.]+$/, '')
    .slice(0, 80)
    .replace(/[-.]+$/, '')
  return sanitized.length > 0 ? sanitized : 'fail'
}

/** Estonian validation message, or null when the upload is acceptable. */
export function validateMediaUpload(input: {
  filename: string
  mimeType: string
  size: number
}): string | null {
  if (input.filename.trim().length === 0) {
    return 'Failinimi puudub.'
  }
  if (!isAllowedMimeType(input.mimeType)) {
    return 'Lubatud on ainult JPEG, PNG, WebP, GIF ja AVIF pildid ning PDF-failid.'
  }
  if (input.size <= 0) {
    return 'Fail on tühi.'
  }
  if (input.size > MAX_UPLOAD_BYTES) {
    return 'Faili maksimaalne suurus on 5 MiB.'
  }
  return null
}

export function buildR2Key(id: string, filename: string): string {
  return `media/${id}-${sanitizeFilename(filename)}`
}

/**
 * Stable public URL for a media row. wrangler.jsonc exposes no public R2
 * URL, so bytes are streamed through this route from the BUCKET binding.
 */
export function mediaUrlFor(id: string): string {
  return `/api/v1/media/${id}`
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—'
  if (bytes < 1024) return `${String(bytes)} B`
  const format = (value: number): string =>
    value.toLocaleString('et-EE', { maximumFractionDigits: 1 })
  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${format(kilobytes)} kB`
  const megabytes = kilobytes / 1024
  if (megabytes < 1024) return `${format(megabytes)} MB`
  return `${format(megabytes / 1024)} GB`
}

// Minimal local R2 surface (same local-declaration approach as the DO
// namespaces in api/v1/bids/create/route.ts; src/lib/storage.ts declares a
// narrower global R2Bucket without a readable body).
export interface MediaR2Object {
  body?: ReadableStream<Uint8Array> | undefined
  size: number
  httpMetadata?: { contentType?: string } | undefined
}

export interface MediaR2Bucket {
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
  get(key: string): Promise<MediaR2Object | null>
  delete(key: string): Promise<void>
}

declare global {
  interface CloudflareEnv {
    /** R2 binding from wrangler.jsonc r2_buckets (eametsad-media). */
    BUCKET?: MediaR2Bucket
  }
}

/** The BUCKET binding for the current invocation, or null when absent. */
export async function getMediaBucket(): Promise<MediaR2Bucket | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const context = await getCloudflareContext({ async: true })
    return context.env.BUCKET ?? null
  } catch {
    return null
  }
}
