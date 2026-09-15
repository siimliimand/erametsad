import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirectMock = vi.hoisted(() =>
  vi.fn((url: string): never => {
    throw new Error(`REDIRECT ${url}`)
  }),
)
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

const sessionMock = vi.hoisted(() => ({
  requirePortalSession: vi.fn(),
}))

vi.mock('@/app/(portal)/_lib/session', () => sessionMock)

import SelectProfilePage from '../page'

const PRIVATE_PROFILE = {
  id: 'p1',
  type: 'private',
  displayName: 'Mari Maasikas',
  approvalStatus: 'approved',
  createdAt: '2026-09-15T10:00:00.000Z',
}

function stubPortal(docs: unknown[]): void {
  const find = vi.fn((args: { collection: string }) => {
    if (args.collection === 'profile') {
      return Promise.resolve({ docs })
    }
    return Promise.resolve({ docs: [] })
  })
  sessionMock.requirePortalSession.mockResolvedValue({
    session: { userId: 'u1', profileId: 'p1', sessionId: 's1' },
    repositories: { find },
  })
}

async function redirectTarget(searchParams: {
  next?: string
}): Promise<string> {
  await expect(
    SelectProfilePage({ searchParams: Promise.resolve(searchParams) }),
  ).rejects.toThrow(/^REDIRECT /)
  const target = redirectMock.mock.calls.at(-1)?.[0]
  if (typeof target !== 'string') throw new Error('redirect was not called')
  return target
}

describe('select-profile page single-profile redirect', () => {
  beforeEach(() => {
    redirectMock.mockClear()
  })

  it('continues into the logged-in user area when there is no next', async () => {
    stubPortal([PRIVATE_PROFILE])

    // Regression: this used to send freshly registered single-profile users
    // to `/`, which is the marketing home on the default host and reads
    // like a logout.
    expect(await redirectTarget({})).toBe('/user/profile')
  })

  it('keeps a safe next destination across the redirect', async () => {
    stubPortal([PRIVATE_PROFILE])

    expect(await redirectTarget({ next: '/oksjon/a1' })).toBe('/oksjon/a1')
  })

  it('drops an unsafe next destination into the user area', async () => {
    stubPortal([PRIVATE_PROFILE])

    expect(await redirectTarget({ next: '//evil.example.ee' })).toBe(
      '/user/profile',
    )
  })

  it('renders the card grid for multi-profile users instead of redirecting', async () => {
    stubPortal([
      PRIVATE_PROFILE,
      {
        id: 'p2',
        type: 'company',
        displayName: 'Mets OÜ',
        companyName: 'Mets OÜ',
        companyRegCode: '12345678',
        approvalStatus: 'approved',
        createdAt: '2026-09-15T10:00:00.000Z',
      },
    ])

    const tree = await SelectProfilePage({
      searchParams: Promise.resolve({}),
    })
    const html = renderToString(tree)

    expect(redirectMock).not.toHaveBeenCalled()
    expect(html).toContain('Mari Maasikas')
    expect(html).toContain('Mets OÜ')
  })
})
