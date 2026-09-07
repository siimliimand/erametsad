// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TabBar, type TabBarItem } from '../TabBar'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const onChangeMock = vi.fn()

const items: TabBarItem[] = [
  { id: 'koik', label: 'Kõik', count: 12 },
  { id: 'aktiivne', label: 'Aktiivsed', count: 3 },
  { id: 'loppenus', label: 'Lõppenud' },
]

let container: HTMLDivElement
let root: Root

async function mount(value = 'koik'): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(
      createElement(TabBar, {
        items,
        value,
        onChange: onChangeMock,
        'aria-label': 'Oksjonite filtriid',
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
  onChangeMock.mockReset()
})

function tabs(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
}

function tablist(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[role="tablist"]')
  if (el === null) throw new Error('tablist not found')
  return el
}

async function pressKey(element: Element, key: string): Promise<void> {
  await act(async () => {
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    )
    await Promise.resolve()
  })
}

describe('TabBar', () => {
  it('renders pill tabs with counts and a roving tabindex on the active tab', async () => {
    await mount()
    expect(tablist().getAttribute('aria-label')).toBe('Oksjonite filtriid')
    expect(tabs().map((tab) => tab.textContent)).toEqual(['Kõik12', 'Aktiivsed3', 'Lõppenud'])

    const states = tabs().map((tab) => [tab.getAttribute('aria-selected'), tab.tabIndex])
    expect(states).toEqual([
      ['true', 0],
      ['false', -1],
      ['false', -1],
    ])
  })

  it('selects a tab on click', async () => {
    await mount()
    await act(async () => {
      tabs()[1]?.click()
      await Promise.resolve()
    })
    expect(onChangeMock).toHaveBeenCalledTimes(1)
    expect(onChangeMock).toHaveBeenCalledWith('aktiivne')
  })

  it('moves focus and selection with ArrowRight and wraps from the last tab', async () => {
    await mount('loppenus')
    await pressKey(tabs()[2] ?? tablist(), 'ArrowRight')
    expect(onChangeMock).toHaveBeenCalledWith('koik')
    expect(document.activeElement).toBe(tabs()[0])
  })

  it('moves back with ArrowLeft and wraps from the first tab', async () => {
    await mount()
    await pressKey(tabs()[0] ?? tablist(), 'ArrowLeft')
    expect(onChangeMock).toHaveBeenCalledWith('loppenus')
    expect(document.activeElement).toBe(tabs()[2])
  })

  it('jumps to the first tab with Home and the last with End', async () => {
    await mount('aktiivne')

    await pressKey(tabs()[1] ?? tablist(), 'Home')
    expect(onChangeMock).toHaveBeenLastCalledWith('koik')
    expect(document.activeElement).toBe(tabs()[0])

    await pressKey(tabs()[0] ?? tablist(), 'End')
    expect(onChangeMock).toHaveBeenLastCalledWith('loppenus')
    expect(document.activeElement).toBe(tabs()[2])
  })

  it('ignores keys outside the roving set', async () => {
    await mount()
    await pressKey(tabs()[0] ?? tablist(), 'ArrowDown')
    await pressKey(tabs()[0] ?? tablist(), 'x')
    expect(onChangeMock).not.toHaveBeenCalled()
  })
})
