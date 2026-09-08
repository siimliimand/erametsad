// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider, useToast, type ToastInput } from '../Toast'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

// Fake timers pin the auto-dismiss setTimeout calls; the pushed toast input
// travels through this holder so each button click pushes a fresh value.
const queued: { current: ToastInput | string } = { current: '' }

function ToastHost(): ReactElement {
  const push = useToast()
  return createElement(
    'button',
    {
      type: 'button',
      onClick: () => {
        push(queued.current)
      },
    },
    'push',
  )
}

let container: HTMLDivElement
let root: Root

async function mount(): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(ToastProvider, null, createElement(ToastHost)))
    await Promise.resolve()
  })
}

function statusRegion(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>('[role="status"]')
  if (el === null) throw new Error('toast region not found')
  return el
}

function pushButton(): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>('button')
  if (el === null) throw new Error('push button not found')
  return el
}

async function pushToast(input: ToastInput | string): Promise<void> {
  queued.current = input
  await act(async () => {
    pushButton().click()
    await Promise.resolve()
  })
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  document.body.textContent = ''
  vi.useRealTimers()
})

describe('Toast', () => {
  it('auto-dismisses after the 3600ms default', async () => {
    await mount()
    await pushToast({ title: 'Salvestatud' })
    expect(statusRegion().textContent).toContain('Salvestatud')

    advance(3599)
    expect(statusRegion().textContent).toContain('Salvestatud')

    advance(1)
    expect(statusRegion().textContent).not.toContain('Salvestatud')
  })

  it('honours a custom durationMs', async () => {
    await mount()
    await pushToast({ title: 'Kustutatud', durationMs: 500 })

    advance(499)
    expect(statusRegion().textContent).toContain('Kustutatud')

    advance(1)
    expect(statusRegion().textContent).not.toContain('Kustutatud')
  })

  it('accepts a plain string push and renders it as the title', async () => {
    await mount()
    await pushToast('Kopeeritud')
    expect(statusRegion().textContent).toContain('Kopeeritud')
  })

  it('keeps at most three toasts and drops the oldest', async () => {
    await mount()
    await pushToast({ title: 'Esimene' })
    await pushToast({ title: 'Teine' })
    await pushToast({ title: 'Kolmas' })
    await pushToast({ title: 'Neljas' })

    const text = statusRegion().textContent
    expect(text).not.toContain('Esimene')
    expect(text).toContain('Teine')
    expect(text).toContain('Kolmas')
    expect(text).toContain('Neljas')
  })

  it('renders tone stripes and the one-shot save-ping dot', async () => {
    await mount()
    await pushToast({ title: 'Ok', tone: 'success', ping: true })
    await pushToast({ title: 'Viga', tone: 'error' })
    await pushToast({ title: 'Infoks' })

    const region = statusRegion()
    expect(region.className).toContain('bottom-6')
    expect(region.className).toContain('left-1/2')

    const toastText = region.textContent
    expect(toastText).toContain('Ok')
    expect(toastText).toContain('Viga')
    expect(toastText).toContain('Infoks')

    const stripes = [...region.children].map((el) => el.className)
    expect(stripes.some((cls) => cls.includes('border-l-accent'))).toBe(true)
    expect(stripes.some((cls) => cls.includes('border-l-danger'))).toBe(true)
    expect(stripes.some((cls) => cls.includes('border-l-info'))).toBe(true)

    const pings = region.querySelectorAll('span[aria-hidden="true"]')
    expect(pings).toHaveLength(1)
    expect(pings[0]?.className).toContain('save-ping')
  })
})
