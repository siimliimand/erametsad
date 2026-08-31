// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { CONSENT_COOKIE, readConsentCookie } from '../../_lib/use-consent'
import { CookieBanner } from '../CookieBanner'

type FetchMock = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>

function jsonOk(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function fetchOkMock(): FetchMock {
  return vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(jsonOk()),
  )
}

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement | null = null
let root: Root | null = null

beforeEach(() => {
  // The jsdom environment shares document.cookie across tests in the file.
  document.cookie = `${CONSENT_COOKIE}=; Max-Age=0; path=/`
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
  document.body.textContent = ''
  vi.unstubAllGlobals()
})

function node(): HTMLElement {
  if (container === null) throw new Error('container missing')
  return container
}

async function mountBanner(): Promise<void> {
  const el = node()
  await act(async () => {
    root = createRoot(el)
    root.render(createElement(CookieBanner))
    await Promise.resolve()
  })
}

function findButton(label: string): HTMLButtonElement {
  const button = Array.from(document.body.querySelectorAll('button')).find(
    (item) => item.textContent === label,
  )
  if (button === undefined) throw new Error(`button not found: ${label}`)
  return button
}

function checkbox(name: string): HTMLInputElement {
  const element = document.body.querySelector<HTMLInputElement>(`input[name="${name}"]`)
  if (element === null) throw new Error(`checkbox not found: ${name}`)
  return element
}

function bannerRegion(): HTMLElement | null {
  return document.body.querySelector('[aria-label="Küpsiste nõusolek"]')
}

function settingsDialog(): HTMLElement | null {
  return document.body.querySelector('[role="dialog"]')
}

async function clickButton(label: string): Promise<void> {
  await act(async () => {
    findButton(label).click()
    await Promise.resolve()
  })
}

function fetchCalls(fetchMock: FetchMock, path: string): Record<string, unknown>[] {
  return fetchMock.mock.calls
    .filter(([url]) => (typeof url === 'string' ? url : url instanceof URL ? url.href : url.url) === path)
    .map(([, init]) =>
      JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>,
    )
}

function consentCookieValue(): string | null {
  for (const part of document.cookie.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== CONSENT_COOKIE) continue
    return decodeURIComponent(part.slice(separator + 1).trim())
  }
  return null
}

function setConsentCookie(consent: Record<string, boolean>): void {
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(consent))}; path=/`
}

describe('CookieBanner consent persistence', () => {
  it('shows the banner when no consent cookie exists', async () => {
    const fetchMock = fetchOkMock()
    vi.stubGlobal('fetch', fetchMock)
    await mountBanner()

    expect(bannerRegion()).not.toBeNull()
    expect(document.body.textContent).toContain('Kasutame küpsiseid lehe toimimiseks')
    expect(fetchCalls(fetchMock, '/api/v1/consent')).toEqual([])
  })

  it('"Ainult vajalikud" writes the necessary-only cookie, POSTs /api/v1/consent and fires cookie_consent through track()', async () => {
    const fetchMock = fetchOkMock()
    vi.stubGlobal('fetch', fetchMock)
    await mountBanner()

    await clickButton('Ainult vajalikud')

    expect(consentCookieValue()).toBe(
      '{"necessary":true,"statistics":false,"marketing":false}',
    )
    expect(readConsentCookie()).toEqual({
      necessary: true,
      statistics: false,
      marketing: false,
    })

    const consentPosts = fetchCalls(fetchMock, '/api/v1/consent')
    expect(consentPosts).toEqual([
      {
        choice: 'rejected',
        categories: { necessary: true, statistics: false, marketing: false },
      },
    ])

    // The analytics ping always carries the decision (D4), even rejected.
    expect(fetchCalls(fetchMock, '/api/v1/events')).toEqual([
      {
        name: 'cookie_consent',
        props: { choice: 'rejected', necessary: true, statistics: false, marketing: false },
      },
    ])

    // Deciding hides the banner for the rest of the visit.
    expect(bannerRegion()).toBeNull()
  })

  it('"Nõustun kõigiga" accepts every category and reports choice "accepted"', async () => {
    const fetchMock = fetchOkMock()
    vi.stubGlobal('fetch', fetchMock)
    await mountBanner()

    await clickButton('Nõustun kõigiga')

    expect(readConsentCookie()).toEqual({
      necessary: true,
      statistics: true,
      marketing: true,
    })
    expect(fetchCalls(fetchMock, '/api/v1/consent')).toEqual([
      {
        choice: 'accepted',
        categories: { necessary: true, statistics: true, marketing: true },
      },
    ])
    expect(fetchCalls(fetchMock, '/api/v1/events')).toEqual([
      {
        name: 'cookie_consent',
        props: { choice: 'accepted', necessary: true, statistics: true, marketing: true },
      },
    ])
    expect(bannerRegion()).toBeNull()
  })

  it('the settings modal saves granular choices as a "custom" decision', async () => {
    const fetchMock = fetchOkMock()
    vi.stubGlobal('fetch', fetchMock)
    await mountBanner()

    await clickButton('Sätete muutmine')

    const dialog = settingsDialog()
    if (dialog === null) throw new Error('settings modal did not open')
    expect(dialog.textContent).toContain('Küpsiste sätted')

    // Necessary is always on and cannot be unticked.
    const necessary = checkbox('consent-necessary')
    expect(necessary.checked).toBe(true)
    expect(necessary.disabled).toBe(true)
    expect(checkbox('consent-statistics').checked).toBe(false)
    expect(checkbox('consent-marketing').checked).toBe(false)

    await act(async () => {
      checkbox('consent-statistics').click()
      await Promise.resolve()
    })
    await clickButton('Salvesta sätted')

    expect(readConsentCookie()).toEqual({
      necessary: true,
      statistics: true,
      marketing: false,
    })
    expect(fetchCalls(fetchMock, '/api/v1/consent')).toEqual([
      {
        choice: 'custom',
        categories: { necessary: true, statistics: true, marketing: false },
      },
    ])
    expect(fetchCalls(fetchMock, '/api/v1/events')).toEqual([
      {
        name: 'cookie_consent',
        props: { choice: 'custom', necessary: true, statistics: true, marketing: false },
      },
    ])
    expect(settingsDialog()).toBeNull()
    // A decision was made: the bottom banner stays hidden too.
    expect(bannerRegion()).toBeNull()
  })

  it('reopens the granular modal from the footer button via [data-cookie-settings]', async () => {
    const fetchMock = fetchOkMock()
    vi.stubGlobal('fetch', fetchMock)
    await mountBanner()
    await clickButton('Nõustun kõigiga')
    expect(settingsDialog()).toBeNull()

    // MarketingFooter renders an inert <button data-cookie-settings>; the
    // document-level listener is its only behaviour.
    const footerButton = document.createElement('button')
    footerButton.setAttribute('data-cookie-settings', '')
    footerButton.textContent = 'Küpsiste sätete muutmine'
    document.body.appendChild(footerButton)

    await act(async () => {
      footerButton.click()
      await Promise.resolve()
    })

    const dialog = settingsDialog()
    if (dialog === null) throw new Error('settings modal did not reopen')
    expect(checkbox('consent-statistics').checked).toBe(true)
    expect(checkbox('consent-marketing').checked).toBe(true)
    expect(bannerRegion()).toBeNull()
  })
})

describe('CookieBanner analytics gating (lib/analytics/track)', () => {
  it('sends other analytics events only with statistics consent; cookie_consent always sends', async () => {
    const fetchMock = fetchOkMock()
    vi.stubGlobal('fetch', fetchMock)
    const { track } = await import('@/lib/analytics/track')

    setConsentCookie({ necessary: true, statistics: false, marketing: false })
    track('page_view', { path: '/avaleht' })
    await Promise.resolve()
    expect(fetchCalls(fetchMock, '/api/v1/events')).toEqual([])

    setConsentCookie({ necessary: true, statistics: true, marketing: false })
    track('page_view', { path: '/avaleht' })
    await Promise.resolve()
    expect(fetchCalls(fetchMock, '/api/v1/events')).toEqual([
      { name: 'page_view', props: { path: '/avaleht' } },
    ])

    // The consent event itself bypasses the statistics gate (D4).
    setConsentCookie({ necessary: true, statistics: false, marketing: false })
    track('cookie_consent', { choice: 'rejected' })
    await Promise.resolve()
    expect(fetchCalls(fetchMock, '/api/v1/events')).toEqual([
      { name: 'page_view', props: { path: '/avaleht' } },
      { name: 'cookie_consent', props: { choice: 'rejected' } },
    ])
  })
})
