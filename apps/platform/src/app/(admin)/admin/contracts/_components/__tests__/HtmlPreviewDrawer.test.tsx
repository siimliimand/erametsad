// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HtmlPreviewDrawer, type DocumentPayload } from '../HtmlPreviewDrawer'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const fetchDocument = vi.fn((_id: string): Promise<DocumentPayload> =>
  Promise.resolve({ ok: true, html: '<p>Proovidokument</p>', error: null }),
)

const offsetParentDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetParent',
)

// jsdom has no layout, so offsetParent is always null and the focusable
// filter reads every element as hidden. Report drawer descendants visible.
function showDrawerContent(): void {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement): Element | null {
      return this.closest('[role="dialog"]') !== null ? container : null
    },
  })
}

function restoreOffsetParent(): void {
  if (offsetParentDescriptor !== undefined) {
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParentDescriptor)
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'offsetParent')
  }
}

let container: HTMLDivElement
let root: Root

async function mountDrawer(): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(
      createElement(HtmlPreviewDrawer, {
        label: 'Vaata PDF',
        drawerTitle: 'Lepingu eelvaade',
        documentId: 'doc-1',
        fetchDocument,
      }),
    )
    await Promise.resolve()
  })
}

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  restoreOffsetParent()
  document.body.textContent = ''
  document.body.style.overflow = ''
  fetchDocument.mockClear()
})

function trigger(): HTMLButtonElement {
  const el = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent === 'Vaata PDF',
  )
  if (el === undefined) throw new Error('drawer trigger not found')
  return el
}

function dialog(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>('[role="dialog"]')
  if (el === null) throw new Error('drawer dialog not found')
  return el
}

function dialogCount(): number {
  return document.body.querySelectorAll('[role="dialog"]').length
}

function closeButton(scope: ParentNode): HTMLButtonElement {
  const el = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent.trim() === 'Sulge',
  )
  if (el === undefined) throw new Error('Sulge button not found')
  return el
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
    await Promise.resolve()
  })
}

async function pressEscape(): Promise<void> {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await Promise.resolve()
  })
}

/** The drawer fetch and the focus handoff both settle on the next frame. */
async function settleDrawer(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25))
  })
}

async function openDrawer(): Promise<void> {
  const triggerButton = trigger()
  triggerButton.focus()
  await click(triggerButton)
  await settleDrawer()
}

describe('HtmlPreviewDrawer labelling', () => {
  it('labels the dialog by its heading and renders the fetched HTML', async () => {
    await mountDrawer()
    expect(dialogCount()).toBe(0)
    await openDrawer()
    expect(fetchDocument).toHaveBeenCalledWith('doc-1')
    const panel = dialog()
    expect(panel.getAttribute('aria-modal')).toBe('true')
    const labelledBy = panel.getAttribute('aria-labelledby')
    if (labelledBy === null) throw new Error('dialog has no aria-labelledby')
    const heading = document.getElementById(labelledBy)
    expect(heading?.tagName).toBe('H2')
    expect(heading?.textContent).toBe('Lepingu eelvaade')
    expect(panel.querySelector('iframe')?.getAttribute('srcdoc')).toBe('<p>Proovidokument</p>')
  })
})

describe('HtmlPreviewDrawer dismissal', () => {
  it('closes on Escape', async () => {
    await mountDrawer()
    await openDrawer()
    expect(dialogCount()).toBe(1)
    await pressEscape()
    expect(dialogCount()).toBe(0)
  })

  it('closes from a backdrop click but not from clicks inside the panel', async () => {
    await mountDrawer()
    await openDrawer()
    const panel = dialog()
    const heading = panel.querySelector('h2')
    if (heading === null) throw new Error('dialog heading not found')
    await click(heading)
    expect(dialogCount()).toBe(1)
    const backdrop = panel.parentElement
    if (backdrop === null) throw new Error('backdrop not found')
    await click(backdrop)
    expect(dialogCount()).toBe(0)
  })
})

describe('HtmlPreviewDrawer focus management', () => {
  it('moves focus into the drawer on open and restores it to the trigger on close', async () => {
    showDrawerContent()
    await mountDrawer()
    await openDrawer()
    const sulge = closeButton(dialog())
    expect(dialog().contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toBe(sulge)
    await click(sulge)
    expect(document.activeElement).toBe(trigger())
  })

  it('cycles Tab inside the drawer with wrap-around in both directions', async () => {
    showDrawerContent()
    await mountDrawer()
    await openDrawer()
    const panel = dialog()
    const sulge = closeButton(panel)
    sulge.focus()

    // Only focusable in the panel, so Tab wraps last -> first (itself).
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true })
    const preventTab = vi.spyOn(tab, 'preventDefault')
    await act(async () => {
      sulge.dispatchEvent(tab)
      await Promise.resolve()
    })
    expect(preventTab).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(sulge)

    const shiftTab = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      cancelable: true,
      bubbles: true,
    })
    const preventShiftTab = vi.spyOn(shiftTab, 'preventDefault')
    await act(async () => {
      sulge.dispatchEvent(shiftTab)
      await Promise.resolve()
    })
    expect(preventShiftTab).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(sulge)
  })
})

describe('HtmlPreviewDrawer scroll lock', () => {
  it('locks body scroll while open and unlocks it after close', async () => {
    await mountDrawer()
    expect(document.body.style.overflow).toBe('')
    await openDrawer()
    expect(document.body.style.overflow).toBe('hidden')
    await pressEscape()
    expect(document.body.style.overflow).toBe('')
  })
})
