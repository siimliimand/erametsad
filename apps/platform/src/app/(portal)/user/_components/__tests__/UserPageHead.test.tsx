import { createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/user/bids',
}))

vi.mock('next/link', () => ({
  default: (props: {
    href: string
    'aria-current'?: string
    children: ReactNode
  }) =>
    createElement(
      'a',
      { href: props.href, 'aria-current': props['aria-current'] },
      props.children,
    ),
}))

import { UserPageHead } from '../UserPageHead'
import { USER_TABS, isUserTabActive } from '../UserSubNav'

function renderHead(props: { title: string; summary?: string }): string {
  return renderToString(createElement(UserPageHead, props))
}

describe('UserPageHead', () => {
  it('renders the Minu keskkond crumb, H1 and summary from the page strings', () => {
    const html = renderHead({
      title: 'Minu pakkumised',
      summary: 'Ülevaade pakkumistest.',
    })
    expect(html).toContain('Minu keskkond')
    expect(html).toContain('aria-label="Asukoht"')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('Minu pakkumised')
    expect(html).toContain('Ülevaade pakkumistest.')
  })

  it('crumb root links to /user/bids and carries the page title as the current crumb', () => {
    const html = renderHead({ title: 'Minu profiil' })
    expect(html).toContain('href="/user/bids"')
    expect(html.indexOf('Minu keskkond')).toBeLessThan(
      html.indexOf('Minu profiil'),
    )
  })

  it('omits the summary paragraph when no summary is passed', () => {
    const html = renderHead({ title: 'Teavitused' })
    expect(html).toContain('Teavitused')
    expect(html).not.toMatch(/<p[\s>]/)
  })

  it('renders the sub-nav below the head band, demo order', () => {
    const html = renderHead({ title: 'Minu pakkumised' })
    expect(html.indexOf('<h1')).toBeLessThan(
      html.indexOf('aria-label="Minu keskkond"'),
    )
  })
})

describe('UserSubNav', () => {
  it('lists the four demo tabs with their hrefs', () => {
    expect(USER_TABS.map((tab) => tab.label)).toEqual([
      'Pakkumised',
      'Objektid',
      'Teavitused',
      'Profiil',
    ])
    expect(USER_TABS.map((tab) => tab.href)).toEqual([
      '/user/bids',
      '/user/objects',
      '/user/notifications',
      '/user/profile',
    ])
  })

  it('renders every tab and marks the active section', () => {
    const html = renderHead({ title: 'Minu pakkumised' })
    expect(html).toContain('href="/user/bids"')
    expect(html).toContain('href="/user/objects"')
    expect(html).toContain('href="/user/notifications"')
    expect(html).toContain('href="/user/profile"')
    expect(html.match(/aria-current="page"/g)).toHaveLength(2)
  })

  it('matches exact and child paths, and nothing outside the user area', () => {
    expect(isUserTabActive('/user/bids', '/user/bids')).toBe(true)
    expect(isUserTabActive('/user/bids/123', '/user/bids')).toBe(true)
    expect(isUserTabActive('/user/objects', '/user/bids')).toBe(false)
    expect(isUserTabActive('/oksjon/abc', '/user/bids')).toBe(false)
  })
})
