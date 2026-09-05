import { describe, expect, it } from 'vitest'

import {
  PermanentRenditionError,
  RENDITION_SPECS,
  buildRenditionKey,
  failedRenditionsJson,
  generateRenditionVariants,
  isRenditionName,
  isRenditionSourceMimeType,
  parseRenditions,
  pendingRenditionsJson,
  planRenditions,
  readyRenditionsJson,
  sanitizeFilename,
  type RenditionCodecs,
  type RenditionImage,
} from './renditions'

function fakeImage(width: number, height: number): RenditionImage {
  return { data: new Uint8ClampedArray(width * height * 4), width, height }
}

function fakeCodecs(source: { width: number; height: number }): {
  codecs: RenditionCodecs
  resizes: { width: number; height: number; inputWidth: number; inputHeight: number }[]
} {
  const resizes: { width: number; height: number; inputWidth: number; inputHeight: number }[] = []
  const codecs: RenditionCodecs = {
    decodeImage: () => Promise.resolve(fakeImage(source.width, source.height)),
    resizeImage: (image, width, height) => {
      resizes.push({ width, height, inputWidth: image.width, inputHeight: image.height })
      return Promise.resolve(fakeImage(width, height))
    },
    encodeImage: (image) =>
      Promise.resolve({
        bytes: new ArrayBuffer(image.width * image.height),
        mimeType: 'image/webp',
      }),
  }
  return { codecs, resizes }
}

describe('sanitizeFilename', () => {
  it('keeps ASCII alphanumerics, dots, and dashes with case', () => {
    expect(sanitizeFilename('Metsa pilt.png')).toBe('Metsa-pilt.png')
  })

  it('falls back to a fixed segment for an empty result', () => {
    expect(sanitizeFilename('???')).toBe('fail')
  })
})

describe('buildRenditionKey', () => {
  it('builds a namespaced key per variant', () => {
    expect(buildRenditionKey('2b1c', 'Metsa pilt.png', 'thumb')).toBe(
      'media/2b1c-thumb-Metsa-pilt.png',
    )
  })

  it('strips path segments from the filename', () => {
    expect(buildRenditionKey('2b1c', '../../evil.png', 'hero')).toBe('media/2b1c-hero-evil.png')
  })
})

describe('isRenditionName / isRenditionSourceMimeType', () => {
  it('accepts only the spec names', () => {
    expect(isRenditionName('hero')).toBe(true)
    expect(isRenditionName('thumbnail')).toBe(false)
  })

  it('accepts only decodable source formats', () => {
    expect(isRenditionSourceMimeType('image/webp')).toBe(true)
    expect(isRenditionSourceMimeType('application/pdf')).toBe(false)
    expect(isRenditionSourceMimeType('image/gif')).toBe(false)
  })
})

describe('planRenditions', () => {
  it('plans every spec for a large source', () => {
    const plans = planRenditions(2000, 1250)
    expect(plans.map((plan) => plan.spec.name)).toEqual(['hero', 'gallery', 'thumb'])
  })

  it('skips specs the source cannot cover without upscaling', () => {
    // 1200x800 covers gallery (cropped 1200x750) and thumb, not hero 1600x1000.
    const plans = planRenditions(1200, 800)
    expect(plans.map((plan) => plan.spec.name)).toEqual(['gallery', 'thumb'])
    const gallery = plans[0]
    expect(gallery?.cropWidth).toBe(1200)
    expect(gallery?.cropHeight).toBe(750)
    expect(gallery?.cropY).toBe(25)
  })

  it('center-crops a wider source to the spec aspect', () => {
    const plans = planRenditions(3000, 1000)
    const hero = plans.find((plan) => plan.spec.name === 'hero')
    expect(hero?.cropWidth).toBe(1600)
    expect(hero?.cropHeight).toBe(1000)
    expect(hero?.cropX).toBe(700)
    expect(hero?.cropY).toBe(0)
  })

  it('plans nothing below the smallest spec', () => {
    expect(planRenditions(300, 200)).toEqual([])
  })

  it('every spec stays coverable for its own floor-size source', () => {
    for (const spec of RENDITION_SPECS) {
      const plans = planRenditions(spec.width, Math.round(spec.width * (4 / 3)))
      expect(plans.map((plan) => plan.spec.name)).toContain(spec.name)
    }
  })
})

describe('generateRenditionVariants', () => {
  it('produces a variant per planned spec with metadata and bytes', async () => {
    const { codecs, resizes } = fakeCodecs({ width: 2000, height: 1250 })
    const { variants, skipped } = await generateRenditionVariants(
      new ArrayBuffer(8),
      'image/jpeg',
      'Metsa pilt.png',
      'm-1',
      codecs,
    )
    expect(skipped).toEqual([])
    expect(variants.map((variant) => variant.name)).toEqual(['hero', 'gallery', 'thumb'])
    const hero = variants[0]
    expect(hero?.key).toBe('media/m-1-hero-Metsa-pilt.png')
    expect(hero?.width).toBe(1600)
    expect(hero?.height).toBe(1000)
    expect(hero?.mimeType).toBe('image/webp')
    expect(hero?.size).toBe(hero?.bytes.byteLength)
    expect(hero?.bytes.byteLength).toBeGreaterThan(0)
    // The resize input is the aspect-cropped image, not the raw source.
    expect(resizes[0]).toEqual({
      width: 1600,
      height: 1000,
      inputWidth: 2000,
      inputHeight: 1250,
    })
  })

  it('reports skipped specs for a small source', async () => {
    const { codecs } = fakeCodecs({ width: 1200, height: 800 })
    const { variants, skipped } = await generateRenditionVariants(
      new ArrayBuffer(8),
      'image/png',
      'pilt.png',
      'm-2',
      codecs,
    )
    expect(skipped).toEqual(['hero'])
    expect(variants.map((variant) => variant.name)).toEqual(['gallery', 'thumb'])
  })

  it('raises a permanent error when the source cannot be decoded', async () => {
    const codecs: RenditionCodecs = {
      decodeImage: () => Promise.reject(new Error('bad bytes')),
      resizeImage: () => Promise.reject(new Error('unreachable')),
      encodeImage: () => Promise.reject(new Error('unreachable')),
    }
    await expect(
      generateRenditionVariants(new ArrayBuffer(8), 'image/jpeg', 'p.png', 'm-3', codecs),
    ).rejects.toBeInstanceOf(PermanentRenditionError)
  })
})

describe('renditions column JSON helpers', () => {
  it('builds the pending, ready, and failed states', () => {
    expect(pendingRenditionsJson()).toEqual({ status: 'pending' })
    const ready = readyRenditionsJson({
      thumb: { key: 'k', width: 350, height: 175, size: 12, mimeType: 'image/webp' },
    })
    expect(ready.status).toBe('ready')
    expect(ready.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(ready.variants?.thumb?.width).toBe(350)
    expect(failedRenditionsJson('_boom_').status).toBe('failed')
  })

  it('parses stored column values and rejects junk', () => {
    const ready = readyRenditionsJson({})
    expect(parseRenditions(JSON.stringify(ready))).toEqual(ready)
    expect(parseRenditions(pendingRenditionsJson())).toEqual({ status: 'pending' })
    expect(parseRenditions(null)).toBeNull()
    expect(parseRenditions('')).toBeNull()
    expect(parseRenditions('not json')).toBeNull()
    expect(parseRenditions('{"status":"nope"}')).toBeNull()
    expect(parseRenditions(42)).toBeNull()
  })
})
