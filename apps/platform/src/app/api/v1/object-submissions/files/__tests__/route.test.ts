import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as MediaUpload from '@/app/(admin)/admin/media/_lib/media-upload'
import { POST } from '@/app/api/v1/object-submissions/files/route'
import { MAX_SUBMISSION_FILE_BYTES, MAX_SUBMISSION_FILES } from '@/lib/object-submission/uploads'

const state = vi.hoisted((): {
  payload: { userId: string; role: string; sessionId: string } | null
  sessionRef: { state: 'active'; sessionId: string } | { state: 'revoked' } | { state: 'unknown' }
  bucket: Record<string, unknown> | null
} => ({
  payload: { userId: 'user-1', role: 'private', sessionId: 'sess-1' },
  sessionRef: { state: 'active', sessionId: 'sess-1' },
  bucket: null,
}))

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: vi.fn(() => state.payload),
}))

vi.mock('@/lib/auth/session', () => ({
  resolveAccessTokenSession: vi.fn(() => Promise.resolve(state.sessionRef)),
}))

// Keep the real sanitizeFilename/constants; only the bucket binding is faked.
vi.mock('@/app/(admin)/admin/media/_lib/media-upload', async (importOriginal) => {
  const actual = await importOriginal<typeof MediaUpload>()
  return {
    ...actual,
    getMediaBucket: () => Promise.resolve(state.bucket),
  }
})

const BASE = 'http://localhost:3000/api/v1/object-submissions/files'

function makeBucket(): { put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> } {
  const put = vi.fn(() => Promise.resolve(undefined))
  const remove = vi.fn(() => Promise.resolve(undefined))
  state.bucket = { put, delete: remove, get: vi.fn(() => Promise.resolve(null)) }
  return { put, delete: remove }
}

function uploadRequest(files: File[], cookie = 'access_token=token.user'): NextRequest {
  const form = new FormData()
  for (const file of files) {
    form.append('files', file)
  }
  return new NextRequest(BASE, {
    method: 'POST',
    body: form,
    headers: cookie ? { cookie } : {},
  })
}

function imageFile(name = 'mets.png', type = 'image/png', size = 2048): File {
  return new File([new Uint8Array(size)], name, { type })
}

beforeEach(() => {
  state.payload = { userId: 'user-1', role: 'private', sessionId: 'sess-1' }
  state.sessionRef = { state: 'active', sessionId: 'sess-1' }
  state.bucket = null
})

describe('POST /api/v1/object-submissions/files auth gate', () => {
  it('answers 401 JSON to an anonymous caller and writes nothing', async () => {
    const bucket = makeBucket()

    const response = await POST(uploadRequest([imageFile()], ''))

    expect(response.status).toBe(401)
    const body = (await response.json()) as { error: string }
    expect(body.error).toBe('Autentimine ebaõnnestus')
    expect(bucket.put).not.toHaveBeenCalled()
  })

  it('answers 401 when the D1 session is revoked', async () => {
    const bucket = makeBucket()
    state.sessionRef = { state: 'revoked' }

    const response = await POST(uploadRequest([imageFile()]))

    expect(response.status).toBe(401)
    expect(bucket.put).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/object-submissions/files validation', () => {
  it('answers 415 to a non-multipart request', async () => {
    makeBucket()

    const response = await POST(
      new NextRequest(BASE, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json', cookie: 'access_token=token.user' },
      }),
    )

    expect(response.status).toBe(415)
  })

  it('answers 422 when the form carries no file and writes nothing', async () => {
    const bucket = makeBucket()

    const response = await POST(uploadRequest([]))

    expect(response.status).toBe(422)
    const body = (await response.json()) as { errors: { files: string } }
    expect(body.errors.files).toContain('vähemalt üks')
    expect(bucket.put).not.toHaveBeenCalled()
  })

  it('answers 422 for a batch over the 10-file cap and writes nothing', async () => {
    const bucket = makeBucket()
    const files = Array.from({ length: MAX_SUBMISSION_FILES + 1 }, () => imageFile())

    const response = await POST(uploadRequest(files))

    expect(response.status).toBe(422)
    const body = (await response.json()) as { errors: { files: string } }
    expect(body.errors.files).toContain('kuni 10 faili')
    expect(bucket.put).not.toHaveBeenCalled()
  })

  it('answers 422 when one file is oversized and writes nothing', async () => {
    const bucket = makeBucket()

    const response = await POST(
      uploadRequest([
        imageFile('ok.png', 'image/png', 1024),
        imageFile('suur.png', 'image/png', MAX_SUBMISSION_FILE_BYTES + 1),
      ]),
    )

    expect(response.status).toBe(422)
    const body = (await response.json()) as { errors: { files: string } }
    expect(body.errors.files).toContain('10 MB')
    expect(bucket.put).not.toHaveBeenCalled()
  })

  it('answers 422 when one file has a disallowed type and writes nothing', async () => {
    const bucket = makeBucket()

    const response = await POST(
      uploadRequest([imageFile(), new File([new Uint8Array(10)], 'viirus.txt', { type: 'text/plain' })]),
    )

    expect(response.status).toBe(422)
    const body = (await response.json()) as { errors: { files: string } }
    expect(body.errors.files).toContain('PDF')
    expect(bucket.put).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/object-submissions/files storage', () => {
  it('answers 503 when the R2 bucket binding is unavailable', async () => {
    state.bucket = null

    const response = await POST(uploadRequest([imageFile()]))

    expect(response.status).toBe(503)
    const body = (await response.json()) as { errors: { files: string } }
    expect(body.errors.files).toContain('pole praegu saadaval')
  })

  it('stores every file and returns the keys in input order', async () => {
    const bucket = makeBucket()
    const png = imageFile('mets.png', 'image/png', 1024)
    const pdf = new File([new Uint8Array(2048)], 'takseer.pdf', { type: 'application/pdf' })
    const webp = imageFile('vaade.webp', 'image/webp', 512)

    const response = await POST(uploadRequest([png, pdf, webp]))

    expect(response.status).toBe(201)
    expect(bucket.put).toHaveBeenCalledTimes(3)
    const body = (await response.json()) as { keys: string[] }
    expect(body.keys).toHaveLength(3)
    for (const key of body.keys) {
      expect(key).toMatch(/^object-submissions\//)
    }
    const putKeys = bucket.put.mock.calls.map((call) => (call as unknown as [string])[0])
    expect(body.keys).toEqual(putKeys)
    expect(putKeys[0]).toContain('mets.png')
    expect(putKeys[1]).toContain('takseer.pdf')
    expect(putKeys[2]).toContain('vaade.webp')
    expect(bucket.put.mock.calls[0]?.[2]).toMatchObject({ httpMetadata: { contentType: 'image/png' } })
  })
})
