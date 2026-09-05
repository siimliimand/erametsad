// Shared rendition rules for the editor media pipeline (design D6,
// docs/design/admin/03 step 5). Consumed by the admin media module, the
// upload action that enqueues rendition jobs, and the queue consumer that
// produces the bytes. Pure only: image decoding/encoding is injected through
// RenditionCodecs so this module never pulls the wasm codecs.

export type RenditionName = 'hero' | 'gallery' | 'thumb'

export interface RenditionSpec {
  name: RenditionName
  width: number
  height: number
}

export const RENDITION_SPECS: readonly RenditionSpec[] = [
  { name: 'hero', width: 1600, height: 1000 },
  { name: 'gallery', width: 1200, height: 750 },
  { name: 'thumb', width: 350, height: 175 },
]

export function isRenditionName(value: unknown): value is RenditionName {
  return typeof value === 'string' && RENDITION_SPECS.some((spec) => spec.name === value)
}

/** Formats the pipeline can decode; only these uploads enqueue jobs. */
export const RENDITION_SOURCE_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

export function isRenditionSourceMimeType(mimeType: string): boolean {
  return RENDITION_SOURCE_MIME_TYPES.includes(mimeType)
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

export function buildRenditionKey(id: string, filename: string, name: RenditionName): string {
  return `media/${id}-${name}-${sanitizeFilename(filename)}`
}

/** Structural stand-in for the DOM ImageData the codecs operate on. */
export interface RenditionImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** Codec seam the queue consumer binds to the @jsquash wasm codecs. */
export interface RenditionCodecs {
  decodeImage(bytes: ArrayBuffer, mimeType: string): Promise<RenditionImage>
  resizeImage(image: RenditionImage, width: number, height: number): Promise<RenditionImage>
  encodeImage(image: RenditionImage): Promise<{ bytes: ArrayBuffer; mimeType: string }>
}

export interface RenditionVariant {
  key: string
  width: number
  height: number
  size: number
  mimeType: string
}

/**
 * JSON stored in the media table's `renditions` column. `pending` is written
 * at upload when the rendition job is enqueued; the consumer flips it to
 * `ready` with the variant list, or to `failed` with a reason for permanent
 * conditions (unreadable row/object, undecodable bytes).
 */
export interface MediaRenditionsJson {
  status: 'pending' | 'ready' | 'failed'
  generatedAt?: string
  error?: string
  variants?: Partial<Record<RenditionName, RenditionVariant>>
}

export function pendingRenditionsJson(): MediaRenditionsJson {
  return { status: 'pending' }
}

export function failedRenditionsJson(error: string): MediaRenditionsJson {
  return { status: 'failed', error }
}

export function readyRenditionsJson(
  variants: Partial<Record<RenditionName, RenditionVariant>>,
): MediaRenditionsJson {
  return { status: 'ready', generatedAt: new Date().toISOString(), variants }
}

/** Safe read of the stored column; unknown shapes degrade to null. */
export function parseRenditions(value: unknown): MediaRenditionsJson | null {
  if (value === null || value === undefined) return null
  let parsed: unknown = value
  if (typeof value === 'string') {
    if (value.length === 0) return null
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const record = parsed as Record<string, unknown>
  if (record.status !== 'pending' && record.status !== 'ready' && record.status !== 'failed') {
    return null
  }
  return parsed as MediaRenditionsJson
}

export interface RenditionPlan {
  spec: RenditionSpec
  /** Center-crop rectangle applied before the resize. */
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
}

/**
 * Which rendition specs a source image can serve. Renditions crop down,
 * never up: after the aspect crop the source must still cover the spec in
 * both axes, otherwise the variant is skipped.
 */
export function planRenditions(sourceWidth: number, sourceHeight: number): RenditionPlan[] {
  const plans: RenditionPlan[] = []
  for (const spec of RENDITION_SPECS) {
    const specAspect = spec.width / spec.height
    const sourceAspect = sourceWidth / sourceHeight
    let cropWidth = sourceWidth
    let cropHeight = sourceHeight
    if (sourceAspect > specAspect) {
      cropWidth = Math.round(sourceHeight * specAspect)
    } else {
      cropHeight = Math.round(sourceWidth / specAspect)
    }
    if (cropWidth < spec.width || cropHeight < spec.height) continue
    plans.push({
      spec,
      cropX: Math.floor((sourceWidth - cropWidth) / 2),
      cropY: Math.floor((sourceHeight - cropHeight) / 2),
      cropWidth,
      cropHeight,
    })
  }
  return plans
}

function cropToAspect(
  image: RenditionImage,
  plan: Pick<RenditionPlan, 'cropX' | 'cropY' | 'cropWidth' | 'cropHeight'>,
): RenditionImage {
  const { cropX, cropY, cropWidth, cropHeight } = plan
  const output = new Uint8ClampedArray(cropWidth * cropHeight * 4)
  for (let row = 0; row < cropHeight; row += 1) {
    const sourceStart = ((cropY + row) * image.width + cropX) * 4
    output.set(image.data.subarray(sourceStart, sourceStart + cropWidth * 4), row * cropWidth * 4)
  }
  return { data: output, width: cropWidth, height: cropHeight }
}

export class PermanentRenditionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermanentRenditionError'
  }
}

export interface GeneratedRendition extends RenditionVariant {
  name: RenditionName
  bytes: ArrayBuffer
}

export interface RenditionGenerationResult {
  variants: GeneratedRendition[]
  skipped: RenditionName[]
}

/**
 * Produces every planned rendition variant from the original bytes. Decoding
 * failures are permanent (retrying cannot parse different bytes) and surface
 * as PermanentRenditionError; resizing and encoding failures propagate so the
 * consumer's retry policy owns them. All encoded variants are returned
 * together; the caller writes each to R2.
 */
export async function generateRenditionVariants(
  original: ArrayBuffer,
  mimeType: string,
  filename: string,
  mediaId: string,
  codecs: RenditionCodecs,
): Promise<RenditionGenerationResult> {
  const image = await codecs.decodeImage(original, mimeType).catch((cause: unknown) => {
    throw new PermanentRenditionError(
      `source image could not be decoded (${cause instanceof Error ? cause.message : String(cause)})`,
    )
  })

  const plans = planRenditions(image.width, image.height)
  const plannedNames = new Set(plans.map((plan) => plan.spec.name))
  const skipped = RENDITION_SPECS.filter((spec) => !plannedNames.has(spec.name)).map(
    (spec) => spec.name,
  )

  const variants: GeneratedRendition[] = []
  for (const plan of plans) {
    const cropped = cropToAspect(image, plan)
    const resized = await codecs.resizeImage(cropped, plan.spec.width, plan.spec.height)
    const encoded = await codecs.encodeImage(resized)
    variants.push({
      name: plan.spec.name,
      key: buildRenditionKey(mediaId, filename, plan.spec.name),
      width: plan.spec.width,
      height: plan.spec.height,
      size: encoded.bytes.byteLength,
      mimeType: encoded.mimeType,
      bytes: encoded.bytes,
    })
  }

  return { variants, skipped }
}
