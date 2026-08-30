import { describe, expect, it } from 'vitest'

import {
  MAX_UPLOAD_BYTES,
  buildR2Key,
  formatFileSize,
  isAllowedMimeType,
  mediaUrlFor,
  sanitizeFilename,
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
