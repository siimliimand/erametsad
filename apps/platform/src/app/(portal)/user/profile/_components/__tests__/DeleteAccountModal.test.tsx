// @vitest-environment jsdom
import { act, createElement, type ReactElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('next/link', () => ({
  default: (props: { href: string; className?: string; children: ReactNode }) =>
    createElement(
      'a',
      { href: props.href, className: props.className },
      props.children,
    ),
}))

import { DeleteAccountModal } from '../DeleteAccountModal'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement | null = null
let root: Root | null = null
let assignMock: Mock<(url: string) => void>
let fetchMock: Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  // The shared Modal focuses via requestAnimationFrame; jsdom may lack it.
  vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) =>
    setTimeout(() => {
      cb(0)
    }, 0),
  )
  assignMock = vi.fn()
  // jsdom marks Location unforgeable, so stub the whole global.
  vi.stubGlobal('location', { assign: assignMock })
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
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
  document.body.innerHTML = ''
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

async function typeConfirmation(value: string): Promise<void> {
  const input = document.body.querySelector<HTMLInputElement>(
    'input[name="confirmation"]',
  )
  if (!input) throw new Error('confirmation input not found')
  // React's value tracker ignores direct .value writes, so the typed text
  // goes through the native setter before the input event.
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
      input,
      value,
    )
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
  })
}

async function submitForm(): Promise<void> {
  const form = document.body.querySelector('form')
  if (!form) throw new Error('form not found')
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await Promise.resolve()
  })
}

describe('DeleteAccountModal', () => {
  it('lists deleted and kept data with the 7-year retention note', async () => {
    await mount(createElement(DeleteAccountModal, { isOpen: true, onClose: vi.fn() }))
    const body = document.body
    expect(body.textContent).toContain('Kustuta konto?')
    expect(body.textContent).toContain('Kustutame: konto ja profiilid')
    expect(body.textContent).toContain('Säilitame: lõppenud oksjonite pakkumised')
    expect(body.textContent).toContain('7 aastat')
  })

  it('keeps the confirm disabled until the typed KUSTUTA is exact', async () => {
    await mount(createElement(DeleteAccountModal, { isOpen: true, onClose: vi.fn() }))

    const confirmButton = (): HTMLButtonElement => {
      const button = Array.from(document.body.querySelectorAll('button')).find(
        (item) => item.textContent.includes('Jätka kustutamist'),
      )
      if (!button) throw new Error('confirm button not found')
      return button
    }

    expect(confirmButton().disabled).toBe(true)
    await typeConfirmation('kustuta')
    expect(confirmButton().disabled).toBe(true)
    await typeConfirmation('KUSTUTA')
    expect(confirmButton().disabled).toBe(false)
  })

  it('POSTs the typed confirmation and lands signed out on the home page', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: 'ok' }))
    await mount(createElement(DeleteAccountModal, { isOpen: true, onClose: vi.fn() }))

    await typeConfirmation('KUSTUTA')
    await submitForm()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0]
    if (call === undefined) throw new Error('fetch was not called')
    const [url, init] = call
    if (init === undefined) throw new Error('fetch init missing')
    expect(url).toBe('/api/v1/my/delete-account')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ confirmation: 'KUSTUTA' })
    expect(assignMock).toHaveBeenCalledWith('/')
    expect(document.body.textContent).not.toContain('ebaõnnestus')
  })

  it('shows the server refusal and stays on the page', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: 'Kontot ei saa praegu kustutada: sul on veel aktiivsed pakkumised.',
      }),
    )
    await mount(createElement(DeleteAccountModal, { isOpen: true, onClose: vi.fn() }))

    await typeConfirmation('KUSTUTA')
    await submitForm()

    expect(assignMock).not.toHaveBeenCalled()
    const alert = document.body.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('aktiivsed pakkumised')
  })

  it('does not call the endpoint while the typed word is wrong', async () => {
    await mount(createElement(DeleteAccountModal, { isOpen: true, onClose: vi.fn() }))

    await typeConfirmation('kustuta')
    await submitForm()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(assignMock).not.toHaveBeenCalled()
  })
})
