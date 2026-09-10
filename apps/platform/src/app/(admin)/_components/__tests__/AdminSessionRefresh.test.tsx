// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const refreshFetch = vi.hoisted(() => vi.fn())

vi.stubGlobal('fetch', refreshFetch)

import { AdminSessionRefresh } from '../AdminSessionRefresh'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

const mount = (): Promise<void> =>
  act(async () => {
    root = createRoot(container)
    root.render(createElement(AdminSessionRefresh))
    await Promise.resolve()
  })

describe('AdminSessionRefresh', () => {
  beforeEach(() => {
    container = document.body.appendChild(document.createElement('div'))
    refreshFetch.mockReset()
    refreshFetch.mockResolvedValue(new Response(null, { status: 200 }))
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('posts the refresh endpoint once on mount with included credentials', async () => {
    await mount()
    await act(async () => {
      await Promise.resolve()
    })
    expect(refreshFetch).toHaveBeenCalledTimes(1)
    expect(refreshFetch).toHaveBeenCalledWith('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
  })

  it('stays idle while the tab is hidden', async () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    await mount()
    await act(async () => {
      await Promise.resolve()
    })
    expect(refreshFetch).not.toHaveBeenCalled()
    visibility.mockRestore()
  })
})
