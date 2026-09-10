// @vitest-environment jsdom
import { act, createElement, type ReactElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: (props: { href: string; className?: string; children?: ReactNode }) =>
    createElement('a', { href: props.href, className: props.className }, props.children),
}))

import { PasswordForm } from '../_components/PasswordForm'

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

function link(href: string): HTMLAnchorElement {
  const element = node().querySelector<HTMLAnchorElement>(`a[href="${href}"]`)
  if (element === null) throw new Error(`link not found: ${href}`)
  return element
}

function submitButton(): HTMLButtonElement {
  const element = node().querySelector<HTMLButtonElement>('button[type="submit"]')
  if (element === null) throw new Error('submit button not found')
  return element
}

function setInputValue(element: HTMLInputElement, value: string): void {
  act(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
    if (descriptor?.set === undefined) {
      throw new Error('value setter unavailable')
    }
    descriptor.set.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('PasswordForm (login fallback)', () => {
  it('renders the demo fields with the numeric isikukood placeholder', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(null))
    await mount(createElement(PasswordForm, { next: null, disabled: false, onSubmit }))

    const code = input('identifier')
    expect(code.getAttribute('placeholder')).toBe('38001010000')
    expect(code.getAttribute('maxlength')).toBe('11')
    expect(code.getAttribute('inputmode')).toBe('numeric')
    expect(input('password')).not.toBeNull()
    expect(link('/reset-password').textContent).toContain('Unustasid salasõna?')
  })

  it('carries next into the reset link', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(null))
    await mount(
      createElement(PasswordForm, { next: '/oksjon/abc', disabled: false, onSubmit }),
    )

    expect(link('/reset-password?next=%2Foksjon%2Fabc')).not.toBeNull()
  })

  it('submits the trimmed identifier and password', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(null))
    await mount(createElement(PasswordForm, { next: null, disabled: false, onSubmit }))

    setInputValue(input('identifier'), ' 38001010000 ')
    setInputValue(input('password'), 'Parool1!')
    await act(async () => {
      submitButton().click()
      await Promise.resolve()
    })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith('38001010000', 'Parool1!')
  })

  it('shows the returned error message', async () => {
    const onSubmit = vi.fn(() => Promise.resolve('Vale kasutajanimi või parool'))
    await mount(createElement(PasswordForm, { next: null, disabled: false, onSubmit }))

    setInputValue(input('identifier'), '38001010000')
    setInputValue(input('password'), 'Parool1!')
    await act(async () => {
      submitButton().click()
      await Promise.resolve()
    })

    const alert = node().querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('Vale kasutajanimi või parool')
  })
})
