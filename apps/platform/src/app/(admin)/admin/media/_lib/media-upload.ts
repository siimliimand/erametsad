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

// ── Editor pipeline (design D6, docs/design/admin/03 step 5) ────────────────
// Stricter than the media-library rules above: the lot editor accepts only
// jpg/png/webp images and PDF attachments, with larger caps because the
// originals feed rendition crops.

export const EDITOR_IMAGE_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

export const MAX_EDITOR_IMAGE_BYTES = 15 * 1024 * 1024

/** Minimum source width; renditions crop down, never up. */
export const MIN_EDITOR_IMAGE_WIDTH = 1200

/** PDF attachments cap (docs 03 media pipeline: "PDF files max 25 MB"). */
export const MAX_EDITOR_PDF_BYTES = 25 * 1024 * 1024

export function isEditorImageMimeType(mimeType: string): boolean {
  return EDITOR_IMAGE_MIME_TYPES.includes(mimeType)
}

/**
 * Estonian validation message, or null when the editor image is acceptable.
 * `width` is optional because it must be measured by the caller (the browser
 * decodes the image; the worker runtime has no decoder), so the min-width
 * rule only runs when a measured width is supplied.
 */
export function validateEditorImageUpload(input: {
  filename: string
  mimeType: string
  size: number
  width?: number
}): string | null {
  if (input.filename.trim().length === 0) {
    return 'Failinimi puudub.'
  }
  if (!isEditorImageMimeType(input.mimeType)) {
    return 'Pilt peab olema JPEG, PNG või WebP-vormingus.'
  }
  if (input.size <= 0) {
    return 'Fail on tühi.'
  }
  if (input.size > MAX_EDITOR_IMAGE_BYTES) {
    return 'Pildi maksimaalne suurus on 15 MB.'
  }
  if (input.width !== undefined && input.width < MIN_EDITOR_IMAGE_WIDTH) {
    return 'Pildi laius peab olema vähemalt 1200 pikslit.'
  }
  return null
}

/** PDF-only attachment rule for the editor's `files` list. */
export function validateEditorAttachmentUpload(input: {
  filename: string
  mimeType: string
  size: number
}): string | null {
  if (input.filename.trim().length === 0) {
    return 'Failinimi puudub.'
  }
  if (input.mimeType !== 'application/pdf') {
    return 'Manused peavad olema PDF-failid.'
  }
  if (input.size <= 0) {
    return 'Fail on tühi.'
  }
  if (input.size > MAX_EDITOR_PDF_BYTES) {
    return 'Manuse maksimaalne suurus on 25 MB.'
  }
  return null
}

export const attachmentTags = ['takseer', 'metsateatised', 'muu'] as const

export type AttachmentTag = (typeof attachmentTags)[number]

export const attachmentTagLabels: Record<AttachmentTag, string> = {
  takseer: 'Takseer',
  metsateatised: 'Metsateatised',
  muu: 'Muu',
}

/** Coerces a stored/unknown value onto a valid tag, defaulting to "muu". */
export function attachmentTagFrom(value: unknown): AttachmentTag {
  return typeof value === 'string' && (attachmentTags as readonly string[]).includes(value)
    ? (value as AttachmentTag)
    : 'muu'
}

// Renditions are DECLARED sizes only. The worker runtime has no image
// decoder (sharp cannot run on Cloudflare Workers) and wrangler.jsonc binds
// no Cloudflare Image Resizing or upload queue, so no in-repo mechanism can
// produce the bytes today; the media table also has no renditions column to
// store variant metadata in. These specs are the single source of truth for
// whichever mechanism (Image Resizing transform on the streaming route, or
// a queue consumer) lands later.
export interface RenditionSpec {
  name: 'hero' | 'gallery' | 'thumb'
  width: number
  height: number
}

export const RENDITION_SPECS: readonly RenditionSpec[] = [
  { name: 'hero', width: 1600, height: 1000 },
  { name: 'gallery', width: 1200, height: 750 },
  { name: 'thumb', width: 350, height: 175 },
]

export function buildRenditionKey(
  id: string,
  filename: string,
  name: RenditionSpec['name'],
): string {
  return `media/${id}-${name}-${sanitizeFilename(filename)}`
}

/**
 * Declared variant metadata for a media row: target sizes plus the R2 keys
 * the generating mechanism would write. Nothing consumes these keys yet —
 * see the gap note above RENDITION_SPECS.
 */
export function declaredRenditions(
  id: string,
  filename: string,
): (RenditionSpec & { key: string })[] {
  return RENDITION_SPECS.map((spec) => ({ ...spec, key: buildRenditionKey(id, filename, spec.name) }))
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
// namespaces in api/v1/bids/create/route.ts).
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
    /** R2 binding from wrangler.jsonc r2_buckets (erametsad-media). */
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
