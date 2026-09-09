// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const users = vi.hoisted(() => ({
  impersonationStateAction: vi.fn(),
  stopImpersonationAction: vi.fn(),
}))

vi.mock('@/app/(admin)/_actions/users', () => ({
  impersonationStateAction: users.impersonationStateAction,
  stopImpersonationAction: users.stopImpersonationAction,
}))

import type { PortalAuthState } from '../../_lib/session'
import { ImpersonationBanner } from '../ImpersonationBanner'

function auth(overrides: Partial<PortalAuthState> = {}): PortalAuthState {
  return {
    userId: 'user-1',
    role: 'user',
    profileId: 'profile-1',
    profileName: 'Mari Maasikas',
    impersonatedBy: 'admin-9',
    ...overrides,
  }
}

// The expiry feed resolves asynchronously; flush the mount effects and the
// .then chain before asserting.
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-09T12:00:00Z'))
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  vi.useRealTimers()
  users.impersonationStateAction.mockReset()
  users.stopImpersonationAction.mockReset()
})

let container: HTMLDivElement
let root: Root

async function mount(authState: PortalAuthState | null): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(ImpersonationBanner, { auth: authState }))
    await Promise.resolve()
  })
}

describe('ImpersonationBanner session expiry countdown', () => {
  it('renders nothing without an active impersonation session', async () => {
    await mount(auth({ impersonatedBy: null }))
    expect(container.textContent).toBe('')
    expect(users.impersonationStateAction).not.toHaveBeenCalled()
  })

  it('shows whose view it is and the remaining time from session expiry', async () => {
    users.impersonationStateAction.mockResolvedValue({
      active: true,
      expiresAt: '2026-09-09T12:29:40.000Z',
    })
    await mount(auth())
    await flush()

    expect(container.textContent).toContain('Vaatled keskkonda kasutajana')
    expect(container.textContent).toContain('Mari Maasikas')
    expect(container.textContent).toContain('Kirjutustegevused on blokeeritud')
    expect(container.textContent).toContain('29:40')
  })

  it('ticks the countdown down once per second', async () => {
    users.impersonationStateAction.mockResolvedValue({
      active: true,
      expiresAt: '2026-09-09T12:29:40.000Z',
    })
    await mount(auth())
    await flush()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(container.textContent).toContain('29:38')
  })

  it('stops the session once when the countdown reaches zero', async () => {
    users.impersonationStateAction.mockResolvedValue({
      active: true,
      expiresAt: '2026-09-09T12:00:02.000Z',
    })
    users.stopImpersonationAction.mockResolvedValue(undefined)
    await mount(auth())
    await flush()
    expect(users.stopImpersonationAction).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100)
    })
    expect(users.stopImpersonationAction).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Vaatlus on lõppemas')

    // Further ticks keep the ending state without repeating the stop action.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(users.stopImpersonationAction).toHaveBeenCalledTimes(1)
  })

  it('keeps the static banner when the expiry feed fails', async () => {
    users.impersonationStateAction.mockRejectedValue(new Error('db down'))
    await mount(auth())
    await flush()

    expect(container.textContent).toContain('Vaatled keskkonda kasutajana')
    expect(container.textContent).not.toMatch(/\d{2}:\d{2}/)
    expect(users.stopImpersonationAction).not.toHaveBeenCalled()
  })
})
