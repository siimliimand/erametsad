import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { RedirectError } = vi.hoisted(() => {
  class RedirectError extends Error {
    constructor(
      readonly url: string,
    ) {
      super(`NEXT_REDIRECT:${url}`)
      this.name = 'RedirectError'
    }
  }
  return { RedirectError }
})

const state = vi.hoisted((): {
  session: { userId: string; role: string }
  repositories: unknown
  headers: Record<string, string>
  accessToken: string | null
} => ({
  session: { userId: 'superadmin-1', role: 'superadmin' },
  repositories: null,
  headers: {},
  accessToken: null,
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string): never => {
    throw new RedirectError(url)
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: (name: string) =>
        name === 'access_token' && state.accessToken
          ? { name, value: state.accessToken }
          : undefined,
    }),
  ),
  headers: vi.fn(() =>
    Promise.resolve({
      get: (name: string) => state.headers[name] ?? null,
    }),
  ),
}))

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: vi.fn(() =>
    state.accessToken
      ? { userId: state.session.userId, role: state.session.role, sessionId: 'sess-123' }
      : null,
  ),
}))

vi.mock('../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

import { setMaintenanceModeAction } from '../settings'

import { computeIpHash } from '@/lib/bidding/place-bid'

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

function makeRepos() {
  const creates: CreateArgs[] = []
  const row: Record<string, unknown> = { id: 'settings-1', maintenanceEnabled: false }
  return {
    find: vi.fn(() => Promise.resolve({ docs: [{ ...row }] })),
    update: vi.fn((args: { collection: string; id: string; data: Record<string, unknown> }) => {
      Object.assign(row, args.data)
      return Promise.resolve({ id: args.id, ...args.data })
    }),
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      return Promise.resolve({ id: 'created-1', ...args.data })
    }),
    creates,
  }
}

describe('audit era columns threaded through the settings writers (task 4.7)', () => {
  let repos: ReturnType<typeof makeRepos>

  beforeEach(() => {
    repos = makeRepos()
    state.repositories = repos
    state.session = { userId: 'superadmin-1', role: 'superadmin' }
    state.headers = {
      'x-forwarded-for': '198.51.100.7, 10.0.0.1',
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0 Safari/537.36',
    }
    state.accessToken = 'token'
  })

  afterEach(() => {
    state.headers = {}
    state.accessToken = null
  })

  it('writes reason, sessionId, ipHash and userAgent on the maintenance entry', async () => {
    await expect(
      setMaintenanceModeAction(
        buildFormData({
          enabled: 'true',
          confirm: 'hooldus',
          reason: 'Andmebaasi hooldus',
        }),
      ),
    ).rejects.toBeInstanceOf(RedirectError)

    const entry = repos.creates.find((create) => create.collection === 'audit-entry')
    expect(entry).toBeDefined()
    expect(entry?.data).toMatchObject({
      action: 'maintenance.start',
      reason: 'Andmebaasi hooldus',
      sessionId: 'sess-123',
      ipHash: computeIpHash('198.51.100.7'),
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0 Safari/537.36',
    })
  })

  it('degrades to null era fields outside a request scope and still audits', async () => {
    state.headers = {}
    state.accessToken = null

    await expect(
      setMaintenanceModeAction(
        buildFormData({
          enabled: 'true',
          confirm: 'hooldus',
          reason: 'Hooldus ilma kontekstita',
        }),
      ),
    ).rejects.toBeInstanceOf(RedirectError)

    const entry = repos.creates.find((create) => create.collection === 'audit-entry')
    expect(entry?.data).toMatchObject({ action: 'maintenance.start' })
    expect(entry?.data.sessionId).toBeUndefined()
    expect(entry?.data.ipHash).toBeUndefined()
    expect(entry?.data.userAgent).toBeUndefined()
  })
})

function buildFormData(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value)
  }
  return data
}
