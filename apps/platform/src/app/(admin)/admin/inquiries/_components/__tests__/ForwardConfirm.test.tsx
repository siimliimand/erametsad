// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ForwardConfirm, type ForwardConfirmRecipient } from '../ForwardConfirm'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const recipients: ForwardConfirmRecipient[] = [
  { id: 'p1', name: 'Metsapartner OÜ', email: 'partner@meil.ee', atCapacity: false },
  { id: 'p2', name: 'Kogu Eesti Mets', email: null, atCapacity: true },
]

let container: HTMLDivElement
let root: Root
const requestSubmit = vi.fn()

async function mount(plainEmail = false): Promise<void> {
  await act(async () => {
    const form = document.createElement('form')
    container = document.createElement('div')
    form.appendChild(container)
    document.body.appendChild(form)
    form.requestSubmit = requestSubmit
    const p1 = document.createElement('input')
    p1.type = 'checkbox'
    p1.name = 'partnerIds'
    p1.value = 'p1'
    p1.checked = true
    const p2 = document.createElement('input')
    p2.type = 'checkbox'
    p2.name = 'partnerIds'
    p2.value = 'p2'
    p2.checked = !plainEmail
    form.appendChild(p1)
    form.appendChild(p2)
    root = createRoot(container)
    root.render(createElement(ForwardConfirm, { recipients }))
    await Promise.resolve()
  })
}

async function unmount(): Promise<void> {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.parentElement?.remove()
}

afterEach(async () => {
  await unmount()
  requestSubmit.mockReset()
})

function trigger(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('button')
  if (button === null) throw new Error('send button not found')
  return button
}

function dialog(): HTMLElement {
  const element = container.querySelector<HTMLElement>('[data-testid="forward-confirm"]')
  if (element === null) throw new Error('confirm dialog not found')
  return element
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
    await Promise.resolve()
  })
}

function buttonByLabel(label: string): HTMLButtonElement {
  const button = [...dialog().querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent === label,
  )
  if (button === undefined) throw new Error(`button "${label}" not found`)
  return button
}

describe('ForwardConfirm (task 8.5)', () => {
  it('lists the selected recipients with their e-mails before sending', async () => {
    await mount(true)
    await click(trigger())

    const text = dialog().textContent
    expect(text).toContain('Kinnita saatmine')
    expect(text).toContain('Päring suunatakse 1 partnerile:')
    expect(text).toContain('Metsapartner OÜ · partner@meil.ee')
    expect(dialog().textContent).not.toContain('Hoiatus')
  })

  it('soft-warns when a selected partner is at capacity and submits on confirm', async () => {
    await mount()
    await click(trigger())

    expect(dialog().textContent).toContain(
      'Hoiatus: vähemalt ühe valitud partneri maht on täidetud.',
    )
    await click(buttonByLabel('Kinnita saatmine'))

    expect(requestSubmit).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-testid="forward-confirm"]')).toBeNull()
  })

  it('sends nothing when the operator cancels', async () => {
    await mount()
    await click(trigger())
    await click(buttonByLabel('Tühista'))

    expect(requestSubmit).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="forward-confirm"]')).toBeNull()
  })

  it('skips capacity warning when only partners with room are selected', async () => {
    await mount(true)
    await click(trigger())

    expect(dialog().textContent).toContain('Metsapartner OÜ · partner@meil.ee')
    expect(dialog().textContent).not.toContain('Kogu Eesti Mets')
    expect(dialog().textContent).not.toContain('Hoiatus')
  })

  it('renders the send button label', async () => {
    await mount()
    expect(trigger().textContent).toBe('Saada valitud partneritele')
  })
})
