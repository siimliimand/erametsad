// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PreferenceMatrix } from '../preference-matrix'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const fetchMock = vi.hoisted(() => vi.fn())

let postTestNotification: () => Response | Promise<Response>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

let container: HTMLDivElement
let root: Root

async function mountMatrix(): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(PreferenceMatrix))
    await flush()
  })
}

async function unmountMatrix(): Promise<void> {
  await act(async () => {
    root.unmount()
    await flush()
  })
  container.remove()
}

function testButton(): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((element) => {
    const label = element.textContent
    return label.includes('Saada test-teavitus') || label.includes('Saadame…')
  })
  if (button === undefined) throw new Error('test notification button not found')
  return button
}

async function clickTestButton(): Promise<void> {
  await act(async () => {
    testButton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
  })
}

beforeEach(() => {
  postTestNotification = () => jsonResponse({ status: 'ok', transport: 'email-binding' })
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? 'GET'
    if (method === 'GET' && url.includes('/api/v1/profiles')) {
      return jsonResponse({ profiles: [{ notificationPreferences: {} }] })
    }
    if (method === 'POST' && url.includes('/api/v1/my/notifications/test')) {
      return postTestNotification()
    }
    return jsonResponse({ error: 'Vigane päring' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(async () => {
  await unmountMatrix()
  vi.unstubAllGlobals()
})

describe('PreferenceMatrix test notification button', () => {
  it('POSTs to /api/v1/my/notifications/test and reports success', async () => {
    await mountMatrix()

    await clickTestButton()

    const postCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).includes('/api/v1/my/notifications/test') &&
        (init as RequestInit | undefined)?.method === 'POST',
    )
    expect(postCall).toBeDefined()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Test-teavitus saadetud — kontrolli oma e-posti postkasti.',
    )
  })

  it('shows the rate-limit message when the endpoint answers 429', async () => {
    await mountMatrix()
    postTestNotification = () =>
      jsonResponse(
        {
          error:
            'Test-teavitust saab saata ainult ühe korra minutis. Proovige mõne minuti pärast uuesti.',
        },
        429,
      )

    await clickTestButton()

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Test-teavitust saab saata ainult ühe korra minutis.',
    )
  })

  it('shows the real error message when sending fails', async () => {
    await mountMatrix()
    postTestNotification = () =>
      jsonResponse(
        { error: 'Test-teavituse saatmine ebaõnnestus: No email transport available' },
        502,
      )

    await clickTestButton()

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Test-teavituse saatmine ebaõnnestus: No email transport available',
    )
  })

  it('disables the button while the request is in flight', async () => {
    await mountMatrix()
    postTestNotification = () => new Promise<Response>(() => undefined)

    await act(async () => {
      testButton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flush()
    })

    expect(testButton().disabled).toBe(true)
  })
})
