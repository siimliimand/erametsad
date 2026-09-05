// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const path = vi.hoisted(() => ({ value: '/paringud/hooldusraie' }))

const trackMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  usePathname: () => path.value,
}))

vi.mock('next/link', () => ({
  default: (props: {
    href: string
    className?: string
    'aria-current'?: string
    onClick?: () => void
    children?: ReactNode
  }) =>
    createElement(
      'a',
      {
        href: props.href,
        className: props.className,
        'aria-current': props['aria-current'],
        // jsdom cannot navigate; cancel the default action but keep onClick.
        onClick: (event: { preventDefault: () => void }) => {
          event.preventDefault()
          props.onClick?.()
        },
      },
      props.children,
    ),
}))

vi.mock('@/lib/analytics/track', () => ({
  track: trackMock,
}))

import { RequestTabs } from '../RequestTabs'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

async function mount(): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(RequestTabs))
    await Promise.resolve()
  })
}

function tabs(): HTMLAnchorElement[] {
  return [...container.querySelectorAll<HTMLAnchorElement>('nav a')]
}

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  trackMock.mockReset()
  path.value = '/paringud/hooldusraie'
})

describe('RequestTabs', () => {
  it('renders the three service tabs as real links in spec order', async () => {
    await mount()

    const nav = container.querySelector('nav')
    expect(nav?.getAttribute('aria-label')).toBe('Teenuste päringud')
    expect(tabs().map((tab) => tab.getAttribute('href'))).toEqual([
      '/paringud/metsamajanduskava',
      '/paringud/metsa-istutamine',
      '/paringud/hooldusraie',
    ])
    expect(tabs().map((tab) => tab.textContent)).toEqual([
      'Metsamajanduskava',
      'Metsa istutamine',
      'Hooldusraie',
    ])
  })

  it('marks the tab matching the pathname as the current page', async () => {
    path.value = '/paringud/metsa-istutamine'
    await mount()

    const states = tabs().map((tab) => tab.getAttribute('aria-current'))
    expect(states).toEqual([null, 'page', null])
  })

  it('fires tab_switch when clicking an inactive tab but not the active one', async () => {
    path.value = '/paringud/metsamajanduskava'
    await mount()

    await act(async () => {
      tabs()[2]?.click()
      await Promise.resolve()
    })

    expect(trackMock).toHaveBeenCalledTimes(1)
    expect(trackMock).toHaveBeenCalledWith('tab_switch', {
      to: '/paringud/hooldusraie',
    })

    await act(async () => {
      tabs()[0]?.click()
      await Promise.resolve()
    })

    expect(trackMock).toHaveBeenCalledTimes(1)
  })
})
