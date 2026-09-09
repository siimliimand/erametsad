// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CopyEmailFallback } from '../CopyEmailFallback'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

async function mount(props: { subject: string; body: string }): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(CopyEmailFallback, props))
    await Promise.resolve()
  })
}

afterEach(async () => {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
})

describe('CopyEmailFallback (task 8.6)', () => {
  it('renders the copy button and the selectable e-mail text', async () => {
    await mount({ subject: 'Erametsa päring: kava', body: 'Kontakt: Eve Lind\nMaakond: HH' })

    const button = [...container.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === 'Kopeeri e-kirja tekst',
    )
    expect(button).toBeDefined()
    const textarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="E-kirja tekst"]',
    )
    expect(textarea?.readOnly).toBe(true)
    expect(textarea?.value).toBe('Erametsa päring: kava\n\nKontakt: Eve Lind\nMaakond: HH')
  })

  it('confirms the copy when the clipboard write succeeds', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })

    await mount({ subject: 'Teema', body: 'Rida' })
    const button = [...container.querySelectorAll('button')][0]
    await act(async () => {
      button?.click()
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledWith('Teema\n\nRida')
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Kopeeritud')
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('falls back to manual selection when the clipboard is unavailable', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: () => Promise.reject(new Error('denied')) },
    })

    await mount({ subject: 'Teema', body: 'Rida' })
    const button = [...container.querySelectorAll('button')][0]
    await act(async () => {
      button?.click()
      await Promise.resolve()
    })

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Kopeerimine ebaõnnestus',
    )
  })
})
