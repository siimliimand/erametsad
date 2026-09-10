// @vitest-environment jsdom
import { act, createElement, type ReactElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('next/link', () => ({
  default: (props: { href: string; className?: string; children: ReactNode }) =>
    createElement('a', { href: props.href, className: props.className }, props.children),
}))

import { ProfileSelector, type ProfileOption } from '../ProfileCard'

const PRIVATE: ProfileOption = {
  id: 'p1',
  type: 'private',
  name: 'Mari Mets',
  regCode: null,
  sub: 'Isiklik profiil',
  active: true,
  pending: false,
  disabled: false,
  note: null,
}

const COMPANY: ProfileOption = {
  id: 'p2',
  type: 'company',
  name: 'OÜ Mets & Koer',
  regCode: '14319209',
  sub: 'Reg 14319209 · Taotlus esitatud 12.03.2026',
  active: false,
  pending: false,
  disabled: false,
  note: null,
}

const PENDING: ProfileOption = {
  id: 'p3',
  type: 'company',
  name: 'OÜ Roheline Mets',
  regCode: '16532207',
  sub: 'Reg 16532207 · Taotlus esitatud 24.08.2026',
  active: false,
  pending: true,
  disabled: true,
  note: 'Pakkumiste õigused avanevad pärast kinnitamist.',
}

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement | null = null
let root: Root | null = null
let assignMock: Mock<(url: string) => void>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  assignMock = vi.fn()
  // jsdom marks Location unforgeable, so stub the whole global.
  vi.stubGlobal('location', { assign: assignMock })
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

function radios(): HTMLElement[] {
  return Array.from(node().querySelectorAll('[role="radio"]'))
}

function radioById(id: string): HTMLElement {
  const element = radios().find((item) => item.getAttribute('data-profile-id') === id)
  if (element === undefined) throw new Error(`radio not found: ${id}`)
  return element
}

function pressKey(element: Element, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

function linkByText(text: string): HTMLAnchorElement {
  const element = Array.from(node().querySelectorAll('a')).find((item) =>
    item.textContent.includes(text),
  )
  if (element === undefined) throw new Error(`link not found: ${text}`)
  return element
}

async function selectAndContinue(
  fetchMock: Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>,
  id: string,
): Promise<void> {
  await act(async () => {
    radioById(id).click()
    await Promise.resolve()
  })
  await act(async () => {
    Array.from(node().querySelectorAll('button'))
      .find((item) => item.textContent.includes('Jätka'))
      ?.click()
    await Promise.resolve()
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
}

describe('ProfileSelector', () => {
  it('renders the demo radio cards with chips, pills and rights list', async () => {
    await mount(
      createElement(ProfileSelector, {
        options: [PRIVATE, COMPANY, PENDING],
        activeProfileId: 'p1',
        grantedTypes: ['raieoigus', 'kinnistu'],
        next: null,
      }),
    )

    // The dashed pending card sits outside the radio group.
    expect(radios()).toHaveLength(2)
    expect(radioById('p1').getAttribute('aria-checked')).toBe('true')
    expect(radioById('p2').getAttribute('aria-checked')).toBe('false')
    expect(node().querySelector('[aria-disabled="true"]')).not.toBeNull()
    expect(node().textContent).toContain('Ülevaatamisel')
    expect(node().textContent).toContain('AKTIIVNE')
    expect(node().textContent).toContain('Eraisik')
    expect(node().textContent).toContain('Ettevõte')
    expect(node().textContent).toContain('Raieõigus')
    expect(node().textContent).toContain('Pakkumiste õigused avanevad pärast kinnitamist.')
    expect(linkByText('Lisa ettevõtte profiil').getAttribute('href')).toBe('/register')
    expect(linkByText('Jäta vahele').getAttribute('href')).toBe('/')
  })

  it('moves the selection with arrow keys and skips the pending card', async () => {
    await mount(
      createElement(ProfileSelector, {
        options: [PRIVATE, COMPANY, PENDING],
        activeProfileId: 'p1',
        grantedTypes: [],
        next: null,
      }),
    )

    pressKey(radioById('p1'), 'ArrowDown')
    expect(radioById('p1').getAttribute('aria-checked')).toBe('false')
    expect(radioById('p2').getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(radioById('p2'))

    // Forward from the last selectable card wraps; the pending card never
    // becomes selectable.
    pressKey(radioById('p2'), 'ArrowDown')
    expect(radioById('p1').getAttribute('aria-checked')).toBe('true')

    // Backward from the first selectable card wraps to the last.
    pressKey(radioById('p1'), 'ArrowUp')
    expect(radioById('p2').getAttribute('aria-checked')).toBe('true')
  })

  it('keeps the pending card unselectable on click', async () => {
    await mount(
      createElement(ProfileSelector, {
        options: [PRIVATE, COMPANY, PENDING],
        activeProfileId: 'p1',
        grantedTypes: [],
        next: null,
      }),
    )

    const pending = node().querySelector<HTMLElement>('[aria-disabled="true"]')
    expect(pending).not.toBeNull()
    await act(async () => {
      pending?.click()
      await Promise.resolve()
    })
    expect(radioById('p1').getAttribute('aria-checked')).toBe('true')
  })

  it('shows the company note when a company profile is selected', async () => {
    await mount(
      createElement(ProfileSelector, {
        options: [PRIVATE, COMPANY],
        activeProfileId: 'p1',
        grantedTypes: [],
        next: null,
      }),
    )

    expect(node().textContent).not.toContain('äriregistri kontroll')
    await act(async () => {
      radioById('p2').click()
      await Promise.resolve()
    })
    expect(node().textContent).toContain('äriregistri kontroll')
  })

  it('posts the selection to the select endpoint and navigates to next', async () => {
    const fetchMock =
      vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
        () => Promise.resolve(new Response(null, { status: 200 })),
      )
    vi.stubGlobal('fetch', fetchMock)
    await mount(
      createElement(ProfileSelector, {
        options: [PRIVATE, COMPANY],
        activeProfileId: 'p1',
        grantedTypes: [],
        next: '/oksjonid',
      }),
    )

    await selectAndContinue(fetchMock, 'p2')

    const call = fetchMock.mock.calls[0]
    expect(call?.[0]).toBe('/api/v1/profiles/p2/select')
    expect(call?.[1]?.method).toBe('POST')
    expect(assignMock).toHaveBeenCalledWith('/oksjonid')
  })

  it('navigates without a POST when the active profile is kept', async () => {
    const fetchMock =
      vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
        () => Promise.resolve(new Response(null, { status: 200 })),
      )
    vi.stubGlobal('fetch', fetchMock)
    await mount(
      createElement(ProfileSelector, {
        options: [PRIVATE, COMPANY],
        activeProfileId: 'p1',
        grantedTypes: [],
        next: null,
      }),
    )

    await act(async () => {
      Array.from(node().querySelectorAll('button'))
        .find((item) => item.textContent.includes('Jätka'))
        ?.click()
      await Promise.resolve()
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(assignMock).toHaveBeenCalledWith('/')
  })

  it('keeps the error copy and stays mounted when the POST fails', async () => {
    const fetchMock =
      vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
        () =>
          Promise.resolve(
            new Response(JSON.stringify({ error: 'Sessioon aegus.' }), {
              status: 401,
              headers: { 'content-type': 'application/json' },
            }),
          ),
      )
    vi.stubGlobal('fetch', fetchMock)
    await mount(
      createElement(ProfileSelector, {
        options: [PRIVATE, COMPANY],
        activeProfileId: 'p1',
        grantedTypes: [],
        next: null,
      }),
    )

    await selectAndContinue(fetchMock, 'p2')

    expect(assignMock).not.toHaveBeenCalled()
    expect(node().querySelector('[role="alert"]')?.textContent).toContain('Sessioon aegus.')
  })
})
