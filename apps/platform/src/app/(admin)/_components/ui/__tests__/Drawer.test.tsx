// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Drawer, type DrawerProps, type DrawerSize } from '../Drawer'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const onCloseMock = vi.fn()

let container: HTMLDivElement
let root: Root

function drawerNode(props: Partial<DrawerProps> = {}): ReactElement {
  return createElement(Drawer, {
    open: true,
    onClose: onCloseMock,
    title: 'Objekti kaart',
    subtitle: 'OKS-2026-001',
    children: 'Sisu',
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

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  document.body.textContent = ''
  onCloseMock.mockReset()
})

function dialog(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>('[role="dialog"]')
  if (el === null) throw new Error('drawer panel not found')
  return el
}

function backdrop(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>('.admin-scope [aria-hidden="true"]')
  if (el === null) throw new Error('drawer backdrop not found')
  return el
}

describe('Drawer', () => {
  it('renders nothing while closed and a right-anchored full-width panel when open', async () => {
    await mount(drawerNode({ open: false }))
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()

    await rerender(drawerNode())
    const panel = dialog()
    expect(panel.getAttribute('aria-modal')).toBe('true')
    // Right slide-over: anchored to the right edge and always full width on
    // mobile; the size caps only kick in from the md (768px) breakpoint up.
    expect(panel.className).toContain('fixed')
    expect(panel.className).toContain('right-0')
    expect(panel.className).toContain('w-full')
    expect(panel.className).toMatch(/md:max-w-\[\d+px\]/)
    expect(document.body.textContent).toContain('Objekti kaart')
    expect(document.body.textContent).toContain('OKS-2026-001')
  })

  it('maps each size prop to its demo width cap', async () => {
    const sizes: [DrawerSize, string][] = [
      ['sm', 'md:max-w-[460px]'],
      ['md', 'md:max-w-[560px]'],
      ['lg', 'md:max-w-[680px]'],
      ['xl', 'md:max-w-[720px]'],
    ]
    await mount(drawerNode({ size: 'sm' }))
    expect(dialog().className).toContain('md:max-w-[460px]')
    for (const [size, widthClass] of sizes.slice(1)) {
      await rerender(drawerNode({ size }))
      expect(dialog().className).toContain(widthClass)
    }

    await rerender(drawerNode())
    expect(dialog().className).toContain('md:max-w-[560px]')
  })

  it('closes on Escape', async () => {
    await mount(drawerNode())
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await Promise.resolve()
    })
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it('closes on a backdrop click', async () => {
    await mount(drawerNode())
    await act(async () => {
      backdrop().click()
      await Promise.resolve()
    })
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  // Characterization test for a known issue (shared with Modal): the focus
  // effect runs before OverlayPortal mounts the panel, so focus is not moved
  // in on open and not restored on close. Flip when fixed.
  it('leaves focus on the trigger while the drawer is open (known focus-move gap)', async () => {
    await mount(drawerNode({ open: false }))
    const trigger = document.createElement('button')
    trigger.textContent = 'Ava kaart'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    await rerender(drawerNode())
    expect(document.activeElement).toBe(trigger)

    await rerender(drawerNode({ open: false }))
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
