import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted((): {
  token: string | undefined
  payload: { userId: string; role: string } | null
  repositories: unknown
  bucket: {
    put: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  } | null
  queue: { send: ReturnType<typeof vi.fn> } | null
} => ({
  token: 'token.super',
  payload: { userId: 'admin-1', role: 'admin' },
  repositories: null,
  bucket: null,
  queue: null,
}))

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (): { value: string | undefined } => ({ value: state.token }),
    }),
}))

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: vi.fn(() => state.payload),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: () => state.repositories,
  sessionGuardContext: (payload: unknown) => payload,
}))

vi.mock('@/app/(admin)/admin/media/_lib/media-upload', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getMediaBucket: () => Promise.resolve(state.bucket),
    getMediaQueue: () => Promise.resolve(state.queue),
  }
})

import { POST } from '../route'

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

function makeRepos(createImpl?: (args: CreateArgs) => Promise<unknown>): {
  creates: CreateArgs[]
  create: ReturnType<typeof vi.fn>
} {
  const creates: CreateArgs[] = []
  const create = vi.fn((args: CreateArgs) => {
    creates.push(args)
    return createImpl ? createImpl(args) : Promise.resolve({ id: args.data.id, ...args.data })
  })
  state.repositories = { create }
  return { creates, create }
}

function makeBucket(): {
  put: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
} {
  state.bucket = {
    put: vi.fn(() => Promise.resolve(undefined)),
    get: vi.fn(() => Promise.resolve(null)),
    delete: vi.fn(() => Promise.resolve(undefined)),
  }
  return state.bucket
}

function makeQueue(): ReturnType<typeof vi.fn> {
  state.queue = { send: vi.fn(() => Promise.resolve(undefined)) }
  return state.queue.send
}

function uploadRequest(fields: Record<string, string | File>): NextRequest {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value)
  }
  return new Request('http://localhost:3000/api/v1/media', {
    method: 'POST',
    body: formData,
  }) as unknown as NextRequest
}

function imageFile(size = 2048): File {
  return new File([new Uint8Array(size)], 'mets.png', { type: 'image/png' })
}

function pdfFile(size = 2048): File {
  return new File([new Uint8Array(size)], 'takseer.pdf', { type: 'application/pdf' })
}

beforeEach(() => {
  state.token = 'token.super'
  state.payload = { userId: 'admin-1', role: 'admin' }
  state.repositories = null
  state.bucket = null
  state.queue = null
})

describe('POST /api/v1/media auth gate', () => {
  it('answers 401 to an anonymous caller', async () => {
    state.token = undefined
    state.payload = null
    const repos = makeRepos()

    const response = await POST(uploadRequest({ file: imageFile() }))

    expect(response.status).toBe(401)
    expect(repos.create).not.toHaveBeenCalled()
  })

  it('answers 403 to a seller without auctions:write', async () => {
    state.payload = { userId: 'seller-1', role: 'seller' }
    const repos = makeRepos()

    const response = await POST(uploadRequest({ file: imageFile() }))

    expect(response.status).toBe(403)
    expect(repos.create).not.toHaveBeenCalled()
  })

  it('answers 403 to a seller even with a valid request body', async () => {
    state.payload = { userId: 'seller-1', role: 'seller' }
    const bucket = makeBucket()
    const repos = makeRepos()

    const response = await POST(uploadRequest({ file: pdfFile() }))

    expect(response.status).toBe(403)
    expect(bucket.put).not.toHaveBeenCalled()
    expect(repos.create).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/media validation', () => {
  it('answers 400 when the form carries no file', async () => {
    makeBucket()
    makeRepos()

    const response = await POST(uploadRequest({}))

    expect(response.status).toBe(400)
  })

  it('answers 400 for an empty file', async () => {
    makeBucket()
    makeRepos()

    const response = await POST(
      uploadRequest({ file: new File([], 'tyhi.png', { type: 'image/png' }) }),
    )

    expect(response.status).toBe(400)
  })

  it('answers 422 for a disallowed mime type', async () => {
    makeBucket()
    makeRepos()

    const response = await POST(
      uploadRequest({ file: new File([new Uint8Array(10)], 'viirus.txt', { type: 'text/plain' }) }),
    )

    expect(response.status).toBe(422)
    const body = (await response.json()) as { error: string }
    expect(body.error).toContain('PDF')
  })

  it('answers 422 for an image over the 15 MB cap', async () => {
    makeBucket()
    makeRepos()

    const response = await POST(
      uploadRequest({ file: imageFile(15 * 1024 * 1024 + 1) }),
    )

    expect(response.status).toBe(422)
    const body = (await response.json()) as { error: string }
    expect(body.error).toContain('15 MB')
  })

  it('answers 422 for a PDF over the 25 MB cap', async () => {
    makeBucket()
    makeRepos()

    const response = await POST(uploadRequest({ file: pdfFile(25 * 1024 * 1024 + 1) }))

    expect(response.status).toBe(422)
  })

  it('answers 503 when the R2 bucket binding is unavailable', async () => {
    state.bucket = null
    makeRepos()

    const response = await POST(uploadRequest({ file: imageFile() }))

    expect(response.status).toBe(503)
  })
})

describe('POST /api/v1/media happy paths', () => {
  it('stores an image, records the row and queues renditions', async () => {
    const bucket = makeBucket()
    const queueSend = makeQueue()
    const { creates } = makeRepos()

    const response = await POST(
      uploadRequest({ file: imageFile(), width: '1600', height: '1000' }),
    )

    expect(response.status).toBe(201)
    expect(bucket.put).toHaveBeenCalledTimes(1)
    const [putKey] = bucket.put.mock.calls[0] as unknown as [string]
    expect(putKey).toContain('media/')

    const body = (await response.json()) as { id: string; url: string }
    expect(body.url).toBe(`/api/v1/media/${body.id}`)
    expect(creates).toHaveLength(1)
    expect(creates[0]?.collection).toBe('media')
    expect(creates[0]?.data).toMatchObject({
      id: body.id,
      filename: 'mets.png',
      mimeType: 'image/png',
      r2Key: putKey,
      url: body.url,
      status: 'published',
      width: 1600,
      height: 1000,
    })
    expect(creates[0]?.data.renditions).toMatchObject({ status: 'pending' })
    expect(queueSend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'media-renditions', mediaId: body.id }),
    )
  })

  it('stores a PDF without the rendition queue or dimensions', async () => {
    const bucket = makeBucket()
    const queueSend = makeQueue()
    const { creates } = makeRepos()

    const response = await POST(uploadRequest({ file: pdfFile() }))

    expect(response.status).toBe(201)
    expect(bucket.put).toHaveBeenCalledTimes(1)
    expect(creates).toHaveLength(1)
    expect(creates[0]?.data).toMatchObject({ mimeType: 'application/pdf' })
    expect(creates[0]?.data.renditions).toBeNull()
    expect(creates[0]?.data.width).toBeUndefined()
    expect(queueSend).not.toHaveBeenCalled()
  })

  it('keeps the queued tag request out of the stored alt when absent', async () => {
    makeBucket()
    const { creates } = makeRepos()

    await POST(uploadRequest({ file: imageFile() }))

    expect(creates[0]?.data.alt).toBeNull()
  })
})

describe('POST /api/v1/media failure rollback', () => {
  it('deletes the R2 object and answers 502 when the row write fails', async () => {
    const bucket = makeBucket()
    makeRepos(() => Promise.reject(new Error('D1 puudub')))

    const response = await POST(uploadRequest({ file: imageFile() }))

    expect(response.status).toBe(502)
    expect(bucket.put).toHaveBeenCalledTimes(1)
    expect(bucket.delete).toHaveBeenCalledTimes(1)
    const [putKey] = bucket.put.mock.calls[0] as unknown as [string]
    expect(bucket.delete).toHaveBeenCalledWith(putKey)
  })
})
