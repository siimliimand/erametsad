import { describe, expect, it } from 'vitest'

import {
  MAX_EDITOR_IMAGE_BYTES,
  MAX_EDITOR_PDF_BYTES,
  MAX_UPLOAD_BYTES,
  MIN_EDITOR_IMAGE_WIDTH,
  RENDITION_SPECS,
  attachmentTagFrom,
  attachmentTagLabels,
  attachmentTags,
  buildR2Key,
  buildRenditionKey,
  declaredRenditions,
  formatFileSize,
  isAllowedMimeType,
  isEditorImageMimeType,
  mediaUrlFor,
  sanitizeFilename,
  validateEditorAttachmentUpload,
  validateEditorImageUpload,
  validateMediaUpload,
} from './media-upload'

describe('sanitizeFilename', () => {
  it('strips path traversal segments', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd')
  })

  it('strips windows path segments', () => {
    expect(sanitizeFilename('C:\\Users\\sim\\pilt.jpg')).toBe('pilt.jpg')
  })

  it('maps disallowed characters to single dashes', () => {
    expect(sanitizeFilename('Metsa püük 2026.jpg')).toBe('Metsa-pu-u-k-2026.jpg')
  })

  it('collapses separator runs', () => {
    expect(sanitizeFilename('a  --  b.png')).toBe('a-b.png')
  })

  it('removes leading and trailing dots and dashes', () => {
    expect(sanitizeFilename('.htaccess')).toBe('htaccess')
    expect(sanitizeFilename('report.pdf.')).toBe('report.pdf')
  })

  it('falls back to a stable name for empty input', () => {
    expect(sanitizeFilename('')).toBe('fail')
    expect(sanitizeFilename('...')).toBe('fail')
    expect(sanitizeFilename('---')).toBe('fail')
  })

  it('caps the length at 80 characters', () => {
    const sanitized = sanitizeFilename(`${'a'.repeat(200)}.png`)
    expect(sanitized.length).toBeLessThanOrEqual(80)
    expect(sanitized.endsWith('.png')).toBe(false)
  })
})

describe('isAllowedMimeType', () => {
  it('accepts raster images and pdf', () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']) {
      expect(isAllowedMimeType(mimeType)).toBe(true)
    }
  })

  it('rejects svg, video and arbitrary types', () => {
    for (const mimeType of ['image/svg+xml', 'video/mp4', 'text/plain', '']) {
      expect(isAllowedMimeType(mimeType)).toBe(false)
    }
  })
})

describe('validateMediaUpload', () => {
  const valid = { filename: 'pilt.png', mimeType: 'image/png', size: 1024 }

  it('accepts an in-range image', () => {
    expect(validateMediaUpload(valid)).toBeNull()
  })

  it('accepts a file exactly at the cap', () => {
    expect(validateMediaUpload({ ...valid, size: MAX_UPLOAD_BYTES })).toBeNull()
  })

  it('rejects a file above the cap', () => {
    expect(validateMediaUpload({ ...valid, size: MAX_UPLOAD_BYTES + 1 })).toBe(
      'Faili maksimaalne suurus on 5 MiB.',
    )
  })

  it('rejects a disallowed mime type', () => {
    expect(validateMediaUpload({ ...valid, mimeType: 'text/plain' })).toBe(
      'Lubatud on ainult JPEG, PNG, WebP, GIF ja AVIF pildid ning PDF-failid.',
    )
  })

  it('rejects an empty file and a missing filename', () => {
    expect(validateMediaUpload({ ...valid, size: 0 })).toBe('Fail on tühi.')
    expect(validateMediaUpload({ ...valid, filename: '  ' })).toBe('Failinimi puudub.')
  })
})

describe('isEditorImageMimeType', () => {
  it('accepts only jpg, png and webp', () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(isEditorImageMimeType(mimeType)).toBe(true)
    }
  })

  it('rejects gif, avif, pdf and arbitrary types', () => {
    for (const mimeType of ['image/gif', 'image/avif', 'application/pdf', 'image/svg+xml', '']) {
      expect(isEditorImageMimeType(mimeType)).toBe(false)
    }
  })
})

describe('validateEditorImageUpload', () => {
  const valid = { filename: 'pilt.jpg', mimeType: 'image/jpeg', size: 1024 }

  it('accepts an in-range image', () => {
    expect(validateEditorImageUpload(valid)).toBeNull()
  })

  it('accepts a file exactly at the 15 MB cap', () => {
    expect(validateEditorImageUpload({ ...valid, size: MAX_EDITOR_IMAGE_BYTES })).toBeNull()
  })

  it('rejects a file above the 15 MB cap', () => {
    expect(validateEditorImageUpload({ ...valid, size: MAX_EDITOR_IMAGE_BYTES + 1 })).toBe(
      'Pildi maksimaalne suurus on 15 MB.',
    )
  })

  it('rejects non-editor mime types even when the library allows them', () => {
    expect(validateEditorImageUpload({ ...valid, mimeType: 'image/gif' })).toBe(
      'Pilt peab olema JPEG, PNG või WebP-vormingus.',
    )
    expect(validateEditorImageUpload({ ...valid, mimeType: 'application/pdf' })).toBe(
      'Pilt peab olema JPEG, PNG või WebP-vormingus.',
    )
  })

  it('accepts a width exactly at the minimum', () => {
    expect(validateEditorImageUpload({ ...valid, width: MIN_EDITOR_IMAGE_WIDTH })).toBeNull()
  })

  it('rejects a width below the minimum', () => {
    expect(validateEditorImageUpload({ ...valid, width: MIN_EDITOR_IMAGE_WIDTH - 1 })).toBe(
      'Pildi laius peab olema vähemalt 1200 pikslit.',
    )
  })

  it('skips the width rule when no width was measured', () => {
    expect(
      validateEditorImageUpload({ filename: valid.filename, mimeType: valid.mimeType, size: valid.size }),
    ).toBeNull()
  })

  it('rejects an empty file and a missing filename', () => {
    expect(validateEditorImageUpload({ ...valid, size: 0 })).toBe('Fail on tühi.')
    expect(validateEditorImageUpload({ ...valid, filename: ' ' })).toBe('Failinimi puudub.')
  })
})

describe('validateEditorAttachmentUpload', () => {
  const valid = { filename: 'takseer.pdf', mimeType: 'application/pdf', size: 1024 }

  it('accepts an in-range pdf', () => {
    expect(validateEditorAttachmentUpload(valid)).toBeNull()
  })

  it('accepts a pdf exactly at the 25 MB cap', () => {
    expect(validateEditorAttachmentUpload({ ...valid, size: MAX_EDITOR_PDF_BYTES })).toBeNull()
  })

  it('rejects a pdf above the 25 MB cap', () => {
    expect(validateEditorAttachmentUpload({ ...valid, size: MAX_EDITOR_PDF_BYTES + 1 })).toBe(
      'Manuse maksimaalne suurus on 25 MB.',
    )
  })

  it('rejects non-pdf files', () => {
    expect(validateEditorAttachmentUpload({ ...valid, mimeType: 'image/png' })).toBe(
      'Manused peavad olema PDF-failid.',
    )
  })

  it('rejects an empty file and a missing filename', () => {
    expect(validateEditorAttachmentUpload({ ...valid, size: 0 })).toBe('Fail on tühi.')
    expect(validateEditorAttachmentUpload({ ...valid, filename: '' })).toBe('Failinimi puudub.')
  })
})

describe('attachmentTags', () => {
  it('exposes the three design-doc tags with Estonian labels', () => {
    expect([...attachmentTags]).toEqual(['takseer', 'metsateatised', 'muu'])
    expect(attachmentTagLabels).toEqual({
      takseer: 'Takseer',
      metsateatised: 'Metsateatised',
      muu: 'Muu',
    })
  })

  it('coerces stored values onto a valid tag', () => {
    expect(attachmentTagFrom('takseer')).toBe('takseer')
    expect(attachmentTagFrom('metsateatised')).toBe('metsateatised')
    expect(attachmentTagFrom('teadmata')).toBe('muu')
    expect(attachmentTagFrom(undefined)).toBe('muu')
    expect(attachmentTagFrom(42)).toBe('muu')
  })
})

describe('RENDITION_SPECS', () => {
  it('declares the design-doc crop sizes in order', () => {
    expect(RENDITION_SPECS).toEqual([
      { name: 'hero', width: 1600, height: 1000 },
      { name: 'gallery', width: 1200, height: 750 },
      { name: 'thumb', width: 350, height: 175 },
    ])
  })
})

describe('buildRenditionKey', () => {
  it('namespaces the variant between the id and the sanitized filename', () => {
    expect(buildRenditionKey('2b1c', 'Metsa pilt.png', 'thumb')).toBe(
      'media/2b1c-thumb-Metsa-pilt.png',
    )
  })

  it('cannot smuggle path separators into the key', () => {
    expect(buildRenditionKey('2b1c', '../../evil.png', 'hero')).toBe('media/2b1c-hero-evil.png')
  })
})

describe('declaredRenditions', () => {
  it('returns one key per declared spec', () => {
    const renditions = declaredRenditions('2b1c', 'pilt.png')
    expect(renditions.map((rendition) => rendition.name)).toEqual(['hero', 'gallery', 'thumb'])
    expect(renditions.every((rendition) => rendition.key.startsWith('media/2b1c-'))).toBe(true)
  })
})

describe('buildR2Key', () => {
  it('places the sanitized filename under the media prefix', () => {
    expect(buildR2Key('2b1c', 'Metsa pilt.png')).toBe('media/2b1c-Metsa-pilt.png')
  })

  it('cannot smuggle path separators into the key', () => {
    expect(buildR2Key('2b1c', '../../evil.png')).toBe('media/2b1c-evil.png')
  })
})

describe('mediaUrlFor', () => {
  it('points at the streaming route', () => {
    expect(mediaUrlFor('2b1c')).toBe('/api/v1/media/2b1c')
  })
})

describe('formatFileSize', () => {
  it('renders missing sizes as a dash', () => {
    expect(formatFileSize(null)).toBe('—')
    expect(formatFileSize(undefined)).toBe('—')
  })

  it('formats bytes, kilobytes, megabytes and gigabytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1024)).toBe('1 kB')
    expect(formatFileSize(1536)).toBe('1,5 kB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB')
    expect(formatFileSize(3 * 1024 * 1024 * 1024)).toBe('3 GB')
  })
})
