import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadRequestAttachmentsZipData } from '../ops'

import type { CoreRepositories } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'

const state = vi.hoisted((): {
  session: { userId: string; role: string }
  repositories: unknown
  bucket: { get: ReturnType<typeof vi.fn> } | null
} => ({
  session: { userId: 'admin-1', role: 'admin' },
  repositories: null,
  bucket: null,
}))

vi.mock('../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
  sessionGuardContext: (payload: unknown) => payload,
}))

vi.mock('../../admin/media/_lib/media-upload', () => ({
  getMediaBucket: vi.fn(() => Promise.resolve(state.bucket)),
}))

vi.mock('@/lib/notifications/email-sender', () => ({
  sendEmail: vi.fn(),
}))

const getRepositoriesMock = vi.mocked(getRepositories)

function r2Object(bytes: Uint8Array): {
  body: ReadableStream<Uint8Array>
  size: number
} {
  return {
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    }),
    size: bytes.length,
  }
}

function useRepos(request: Record<string, unknown> | null): ReturnType<typeof makeRepos> {
  const repos = makeRepos(request)
  state.repositories = repos
  getRepositoriesMock.mockResolvedValue(repos as unknown as CoreRepositories)
  return repos
}

function makeRepos(request: Record<string, unknown> | null) {
  return {
    findByID: vi.fn((args: { collection: string }): Promise<unknown> =>
      Promise.resolve(args.collection === 'service-requests' ? request : null),
    ),
    find: vi.fn(() => Promise.resolve({ docs: [] })),
    create: vi.fn((args: { collection: string; data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'audit-1', ...args.data }),
    ),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

describe('loadRequestAttachmentsZipData (task 8.5)', () => {
  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    state.bucket = { get: vi.fn() }
  })

  it('collects the stored attachments and audits the download', async () => {
    const repos = useRepos({
      id: 'req-1',
      type: 'kava',
      attachments: ['service-requests/1-plaan.pdf', 'service-requests/2-kaart.png'],
    })
    state.bucket?.get.mockImplementation((key: string) => {
      const bytes = new TextEncoder().encode(`bytes-of-${key}`)
      return Promise.resolve({
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes)
            controller.close()
          },
        }),
        size: bytes.length,
      })
    })

    const result = await loadRequestAttachmentsZipData('req-1')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.requestLabel).toBe('kava-req-1')
    expect(result.entries.map((entry) => entry.name)).toEqual([
      '1-plaan.pdf',
      '2-kaart.png',
    ])
    expect(result.entries[0]?.bytes).toEqual(
      new TextEncoder().encode('bytes-of-service-requests/1-plaan.pdf'),
    )
    const audit = repos.create.mock.calls.find(
      (call) => call[0].collection === 'audit-entry',
    )
    expect(audit?.[0].data).toMatchObject({
      action: 'request.attachments_zip',
      entityId: 'req-1',
    })
  })

  it('skips objects that are gone from storage', async () => {
    useRepos({
      id: 'req-1',
      type: 'hooldusraie',
      attachments: ['service-requests/gone.pdf', 'service-requests/here.pdf'],
    })
    state.bucket?.get.mockImplementation((key: string) =>
      key.endsWith('gone.pdf')
        ? Promise.resolve(null)
        : Promise.resolve(r2Object(new TextEncoder().encode('x'))),
    )

    const result = await loadRequestAttachmentsZipData('req-1')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.entries.map((entry) => entry.name)).toEqual(['here.pdf'])
  })

  it('reports a request without attachments', async () => {
    useRepos({ id: 'req-1', type: 'kava', attachments: [] })

    const result = await loadRequestAttachmentsZipData('req-1')

    expect(result).toMatchObject({ ok: false, error: 'Päringul ei ole manuseid.' })
  })

  it('refuses callers without inquiries read rights', async () => {
    state.session = { userId: 'seller-1', role: 'seller' }
    useRepos({ id: 'req-1', type: 'kava', attachments: ['service-requests/1.pdf'] })

    const result = await loadRequestAttachmentsZipData('req-1')

    expect(result.ok).toBe(false)
  })
})
