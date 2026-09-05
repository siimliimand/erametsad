// jSquash-backed codec implementation for the media rendition pipeline.
// Kept separate from queue-consumer.ts so tests can inject fake codecs and
// never load the wasm modules. All jSquash imports are dynamic for the same
// reason.
//
// workerd has no DOM ImageData constructor, but @jsquash/resize constructs
// `new ImageData(...)` internally; ensureImageDataGlobal installs a minimal
// stand-in before the codecs run. The decoders return plain
// {data, width, height} objects, which satisfy the same shape.

import {
  PermanentRenditionError,
  type RenditionCodecs,
  type RenditionImage,
} from '../lib/media/renditions'

/** Editor-pipeline source formats (media-upload.ts EDITOR_IMAGE_MIME_TYPES). */
const DECODABLE_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']

/** Renditions encode to WebP: broadly supported and much smaller than JPEG. */
const RENDITION_MIME_TYPE = 'image/webp'
const WEBP_QUALITY = 82

let imageDataReady = false

export function ensureImageDataGlobal(): void {
  if (imageDataReady) return
  const globalScope = globalThis as Record<string, unknown>
  if (typeof globalScope.ImageData === 'function') {
    imageDataReady = true
    return
  }
  class ImageDataPolyfill {
    data: Uint8ClampedArray
    width: number
    height: number
    colorSpace = 'srgb' as const
    constructor(
      data: Uint8ClampedArray | number[],
      width: number,
      height?: number,
    ) {
      const pixels = data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data)
      const resolvedHeight = height ?? Math.floor(pixels.length / (4 * width))
      if (width <= 0 || resolvedHeight <= 0) {
        throw new Error('invalid ImageData dimensions')
      }
      if (pixels.length !== 4 * width * resolvedHeight) {
        throw new Error('ImageData byte length does not match the dimensions')
      }
      this.data = pixels
      this.width = width
      this.height = resolvedHeight
    }
  }
  globalScope.ImageData = ImageDataPolyfill
  imageDataReady = true
}

function decoderFor(mimeType: string): Promise<{
  decode: (buffer: ArrayBuffer) => Promise<RenditionImage>
}> {
  switch (mimeType) {
    case 'image/jpeg':
      return import('@jsquash/jpeg')
    case 'image/png':
      return import('@jsquash/png')
    case 'image/webp':
      return import('@jsquash/webp')
    default:
      throw new PermanentRenditionError(`unsupported source mime type "${mimeType}"`)
  }
}

/**
 * Real codec binding for RenditionCodecs. Fails fast with a permanent error
 * for source formats no decoder exists for (PDFs, GIF, AVIF never enqueue).
 */
export function createRenditionCodecs(): RenditionCodecs {
  return {
    async decodeImage(bytes: ArrayBuffer, mimeType: string): Promise<RenditionImage> {
      if (!DECODABLE_MIME_TYPES.includes(mimeType)) {
        throw new PermanentRenditionError(`unsupported source mime type "${mimeType}"`)
      }
      ensureImageDataGlobal()
      const codec = await decoderFor(mimeType)
      return codec.decode(bytes)
    },
    async resizeImage(image: RenditionImage, width: number, height: number): Promise<RenditionImage> {
      ensureImageDataGlobal()
      const { default: resize } = await import('@jsquash/resize')
      return resize(image as unknown as ImageData, { width, height })
    },
    async encodeImage(image: RenditionImage): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
      ensureImageDataGlobal()
      // The webp entry exposes named exports only (no default).
      const { encode } = await import('@jsquash/webp')
      const bytes = await encode(image as unknown as ImageData, { quality: WEBP_QUALITY })
      return { bytes, mimeType: RENDITION_MIME_TYPE }
    },
  }
}
