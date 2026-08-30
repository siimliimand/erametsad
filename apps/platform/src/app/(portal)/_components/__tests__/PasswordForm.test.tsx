// @vitest-environment jsdom
import { act, createElement, type ReactElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('next/link', () => ({
  default: (props: { href: string; className?: string; children: ReactNode }) =>
    createElement('a', { href: props.href, className: props.className }, props.children),
}))

import { PasswordForm } from '../PasswordForm'

const VALID_PASSWORD = 'Aa1!bbbbbb'
const ISIKUKOOD = '32708100019'

// React SSR separates adjacent text nodes with <!-- --> comments; strip them
// so text assertions read like the rendered text.
function plain(value: string): string {
  return value.replace(/<!--.*?-->/g, '')
}

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement | null = null
let root: Root | null = null

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  if (root !== null) {
    act(() => {
      root?.unmount()
    })
    root = null
  }
  container?.remove()
  container = null
  vi.unstubAllGlobals()
})

function node(): HTMLElement {
  if (container === null) throw new Error('container missing')
  return container
}

async function mount(element: ReactElement): Promise<void> {
  const el = node()
  await act(async () => {
    root = createRoot(el)
    root.render(element)
    await Promise.resolve()
  })
}

function input(name: string): HTMLInputElement {
  const element = node().querySelector<HTMLInputElement>(`input[name="${name}"]`)
  if (element === null) throw new Error(`input not found: ${name}`)
  return element
}

function findButton(label: string): HTMLButtonElement {
  const button = Array.from(node().querySelectorAll('button')).find((item) =>
    item.textContent.includes(label),
  )
  if (button === undefined) throw new Error(`button not found: ${label}`)
  return button
}

function setInputValue(element: HTMLInputElement, value: string): void {
  act(() => {
    // The prototype setter bypasses React's value tracker so the controlled
    // input registers the change.
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
    if (descriptor?.set === undefined) {
      throw new Error('value setter unavailable')
    }
    descriptor.set.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function jsonOk(payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

async function submitFilled(): Promise<void> {
  await act(async () => {
    findButton('Salvesta').click()
    await Promise.resolve()
  })
}

interface FetchCall {
  url: RequestInfo | URL
  method: string
  body: Record<string, unknown>
}

type FetchMock = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>

function singleFetchCall(mock: FetchMock): FetchCall {
  expect(mock).toHaveBeenCalledTimes(1)
  const call = mock.mock.calls[0]
  if (call === undefined) throw new Error('fetch was not called')
  const init = call[1]
  if (init === undefined) throw new Error('fetch init missing')
  return {
    url: call[0],
    method: String(init.method),
    body: JSON.parse(init.body as string) as Record<string, unknown>,
  }
}

describe('PasswordForm request bodies', () => {
  it('posts newPassword only for the first-time set (?first=1)', async () => {
    const fetchMock =
      vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
        () => Promise.resolve(jsonOk({ message: 'Parool on määratud' })),
      )
    vi.stubGlobal('fetch', fetchMock)
    await mount(
      createElement(PasswordForm, {
        endpoint: '/api/v1/auth/change-password',
        submitLabel: 'Salvesta',
      }),
    )

    setInputValue(input('new-password'), VALID_PASSWORD)
    await submitFilled()

    const call = singleFetchCall(fetchMock)
    expect(call.url).toBe('/api/v1/auth/change-password')
    expect(call.method).toBe('POST')
    expect(call.body).toEqual({ newPassword: VALID_PASSWORD })
  })

  it('posts oldPassword and newPassword for the change flow', async () => {
    const fetchMock =
      vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
        () => Promise.resolve(jsonOk({ message: 'Parool on muudetud' })),
      )
    vi.stubGlobal('fetch', fetchMock)
    await mount(
      createElement(PasswordForm, {
        endpoint: '/api/v1/auth/change-password',
        withCurrentPassword: true,
        submitLabel: 'Salvesta',
      }),
    )

    setInputValue(input('current-password'), 'VanaParool1!')
    setInputValue(input('new-password'), VALID_PASSWORD)
    await submitFilled()

    const call = singleFetchCall(fetchMock)
    expect(call.url).toBe('/api/v1/auth/change-password')
    expect(call.body).toEqual({
      oldPassword: 'VanaParool1!',
      newPassword: VALID_PASSWORD,
    })
  })

  it('posts token and password for the reset flow', async () => {
    const fetchMock =
      vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
        () => Promise.resolve(jsonOk({ message: 'Parool on edukalt lähtestatud' })),
      )
    vi.stubGlobal('fetch', fetchMock)
    await mount(
      createElement(PasswordForm, {
        endpoint: '/api/v1/auth/reset-password',
        resetToken: 'tok-abc',
        submitLabel: 'Salvesta',
      }),
    )

    setInputValue(input('new-password'), VALID_PASSWORD)
    await submitFilled()

    const call = singleFetchCall(fetchMock)
    expect(call.url).toBe('/api/v1/auth/reset-password')
    expect(call.body).toEqual({ token: 'tok-abc', password: VALID_PASSWORD })
  })
})

describe('PasswordForm behaviour', () => {
  it('swaps to the success panel on 200', async () => {
    const fetchMock =
      vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
        () => Promise.resolve(jsonOk({ message: 'Parool on muudetud. Palun logige uuesti sisse.' })),
      )
    vi.stubGlobal('fetch', fetchMock)
    await mount(
      createElement(PasswordForm, {
        endpoint: '/api/v1/auth/change-password',
        successTitle: 'Parool on muudetud',
        successNote: createElement('p', null, 'Kõik sinu sessioonid on suletud.'),
      }),
    )

    setInputValue(input('new-password'), VALID_PASSWORD)
    await submitFilled()

    const status = node().querySelector('[role="status"]')
    expect(status).not.toBeNull()
    expect(plain(status?.textContent ?? '')).toContain('Parool on muudetud')
    expect(plain(status?.textContent ?? '')).toContain('Kõik sinu sessioonid on suletud.')
  })

  it('shows the server error and footer on failure', async () => {
    const fetchMock =
      vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
        () =>
          Promise.resolve(
            new Response(JSON.stringify({ error: 'Vale vana parool' }), {
              status: 400,
              headers: { 'content-type': 'application/json' },
            }),
          ),
      )
    vi.stubGlobal('fetch', fetchMock)
    await mount(
      createElement(PasswordForm, {
        endpoint: '/api/v1/auth/change-password',
        withCurrentPassword: true,
        errorFooter: createElement('a', { href: '/reset-password' }, 'Taotle lähtestamislink'),
      }),
    )

    setInputValue(input('current-password'), 'ValeParool1!')
    setInputValue(input('new-password'), VALID_PASSWORD)
    await submitFilled()

    expect(plain(node().textContent)).toContain('Vale vana parool')
    expect(plain(node().textContent)).toContain('Taotle lähtestamislink')
  })

  it('keeps the submit gate closed while the password equals the isikukood', async () => {
    await mount(
      createElement(PasswordForm, {
        endpoint: '/api/v1/auth/change-password',
        isikukood: ISIKUKOOD,
        submitLabel: 'Salvesta',
      }),
    )

    setInputValue(input('new-password'), ISIKUKOOD)
    expect(plain(node().textContent)).toContain('Ei tohi olla sinu isikukood')
    expect(findButton('Salvesta').disabled).toBe(true)
  })
})
