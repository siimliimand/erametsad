// @vitest-environment jsdom
import { act, createElement, useState, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Drawer } from '../Drawer'
import { Modal, type ModalProps } from '../Modal'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const onCloseMock = vi.fn()

let container: HTMLDivElement
let root: Root

function modalNode(props: Partial<ModalProps> = {}): ReactElement {
  return createElement(Modal, {
    open: true,
    onClose: onCloseMock,
    title: 'Kinnitus',
    children: 'Kas kinnitad?',
    ...props,
  })
}

async function mount(node: ReactElement): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(node)
    await Promise.resolve()
  })
}

async function rerender(node: ReactElement): Promise<void> {
  await act(async () => {
    root.render(node)
    await Promise.resolve()
  })
}

// Focus defers to the next frame while the overlay portal mounts.
async function nextFrame(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25))
  })
}

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  // OverlayPortal renders into document.body, so portal residue needs a sweep.
  document.body.textContent = ''
  document.body.style.overflow = ''
  onCloseMock.mockReset()
})

function dialog(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>('[role="dialog"]')
  if (el === null) throw new Error('dialog not found')
  return el
}

function dialogs(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>('[role="dialog"]')]
}

async function pressEscape(): Promise<void> {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await Promise.resolve()
  })
}

async function pressKey(element: Element, init: KeyboardEventInit): Promise<void> {
  await act(async () => {
    element.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
    )
    await Promise.resolve()
  })
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
    await Promise.resolve()
  })
}

// jsdom has no layout engine, so offsetParent is always null and
// getFocusableElements filters everything out. Patching the prototype makes
// the focus trap behave like a real browser for the circulation test.
function stubVisibleElements(): () => void {
  const proto =
    Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent') !== undefined
      ? HTMLElement.prototype
      : Element.prototype
  const original = Object.getOwnPropertyDescriptor(proto, 'offsetParent')
  Object.defineProperty(proto, 'offsetParent', { value: document.body, configurable: true })
  return () => {
    if (original) Object.defineProperty(proto, 'offsetParent', original)
    else
      Object.defineProperty(proto, 'offsetParent', {
        get: () => null,
        configurable: true,
      })
  }
}

function DrawerWithConfirm(): ReactElement {
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  return createElement(Drawer, {
    open: drawerOpen,
    onClose: () => {
      setDrawerOpen(false)
    },
    title: 'Kaart',
    children: [
      createElement(
        'button',
        {
          type: 'button',
          onClick: () => {
            setModalOpen(true)
          },
          key: 'open',
        },
        'Ava kinnitus',
      ),
      createElement(Modal, {
        open: modalOpen,
        onClose: () => {
          setModalOpen(false)
        },
        title: 'Väike kinnitus',
        key: 'modal',
        children: 'Kas kinnitad?',
      }),
    ],
  })
}

describe('Modal', () => {
  it('renders nothing while closed and a labelled dialog when open', async () => {
    await mount(modalNode({ open: false }))
    expect(dialogs()).toHaveLength(0)

    await rerender(modalNode())
    const panel = dialog()
    expect(panel.getAttribute('aria-modal')).toBe('true')
    const heading = document.body.querySelector('h2')
    expect(heading?.textContent).toBe('Kinnitus')
    expect(panel.getAttribute('aria-labelledby')).toBe(heading?.id)
    expect(document.body.textContent).toContain('Kas kinnitad?')
  })

  it('applies the two demo widths per size', async () => {
    await mount(modalNode({ size: 'sm' }))
    expect(dialog().className).toContain('max-w-[480px]')

    await rerender(modalNode({ size: 'lg' }))
    expect(dialog().className).toContain('max-w-[720px]')
  })

  it('closes on Escape', async () => {
    await mount(modalNode())
    await pressEscape()
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it('closes from a backdrop click but not from clicks inside the panel', async () => {
    await mount(modalNode())
    const panel = dialog()
    await click(panel)
    expect(onCloseMock).not.toHaveBeenCalled()

    const backdrop = panel.parentElement
    if (backdrop === null) throw new Error('backdrop not found')
    await click(backdrop)
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it('locks body scroll while open and restores it on close', async () => {
    await mount(modalNode())
    expect(document.body.style.overflow).toBe('hidden')

    await rerender(modalNode({ open: false }))
    expect(document.body.style.overflow).toBe('')
  })

  // Focus moves into the panel on open (after the portal mounts, one commit
  // later) and returns to the trigger on close.
  it('moves focus into the dialog on open and restores it to the trigger on close', async () => {
    await act(async () => {
      container = document.createElement('div')
      document.body.appendChild(container)
      root = createRoot(container)
      root.render(modalNode({ open: false }))
      await Promise.resolve()
    })
    const trigger = document.createElement('button')
    trigger.textContent = 'Ava'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    await rerender(modalNode())
    await nextFrame()
    expect(dialog().contains(document.activeElement)).toBe(true)

    await rerender(modalNode({ open: false }))
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('circulates Tab among the panel focusables at both edges', async () => {
    const restore = stubVisibleElements()
    try {
      await mount(
        modalNode({
          footer: createElement(
            'button',
            { type: 'button', onClick: onCloseMock },
            'Kinnita',
          ),
        }),
      )
      const panel = dialog()
      const buttons = [...panel.querySelectorAll('button')]
      expect(buttons.length).toBe(2)

      // KNOWN ISSUE (reported, not fixed here): useDialogFocus runs on the
      // commit where OverlayPortal still renders null, so focus is not moved
      // into the dialog on open. Seed focus manually to exercise the trap.
      buttons[buttons.length - 1]?.focus()
      await pressKey(buttons[buttons.length - 1] ?? panel, { key: 'Tab' })
      expect(document.activeElement).toBe(buttons[0])

      await pressKey(buttons[0] ?? panel, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(buttons[buttons.length - 1])

      // Tab from a stop that is not the last edge is not intercepted.
      await pressKey(buttons[0] ?? panel, { key: 'Tab' })
      expect(document.activeElement).toBe(buttons[0])
    } finally {
      restore()
    }
  })

  it('does not yank focus already inside the dialog when the retry lands late', async () => {
    // The deferred focusPanel retry fires a frame after open; focus placed
    // inside the panel before then must survive it (regression: the retry
    // unconditionally pulled focus back to the first focusable).
    const restore = stubVisibleElements()
    try {
      await mount(modalNode())
      const panel = dialog()
      panel.focus()
      await nextFrame()
      expect(document.activeElement).toBe(panel)
    } finally {
      restore()
    }
  })

  it('Escape closes only the topmost overlay in the shared stack', async () => {
    await mount(createElement(DrawerWithConfirm))
    expect(dialogs()).toHaveLength(1)

    const openConfirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === 'Ava kinnitus',
    )
    if (openConfirm === undefined) throw new Error('trigger not found')
    await click(openConfirm)
    expect(dialogs()).toHaveLength(2)

    await pressEscape()
    expect(dialogs()).toHaveLength(1)
    expect(dialogs()[0]?.textContent).toContain('Kaart')

    await pressEscape()
    expect(dialogs()).toHaveLength(0)
  })
})
