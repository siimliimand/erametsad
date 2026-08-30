import { createElement, type ComponentProps, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: (props: ComponentProps<'a'> & { children: ReactNode }) =>
    createElement(
      'a',
      {
        href: props.href,
        className: props.className,
        'aria-current': props['aria-current'],
      },
      props.children,
    ),
}))

import {
  DEFAULT_LISTING_TAB,
  LISTING_TABS,
  LISTING_TAB_IDS,
  ListingTabs,
  buildListingHref,
  listingTabDef,
  resolveListingTab,
} from '../ListingTabs'
import type { ListingTabId } from '../../_lib/summary'

const koikDef = listingTabDef('koik')

const COUNTS = Object.fromEntries(
  LISTING_TABS.map((tab) => [tab.id, tab.id === 'koik' ? 10 : 2]),
) as Record<ListingTabId, number>

function render(activeTab: ListingTabId, params: Record<string, string> = {}): string {
  return renderToString(createElement(ListingTabs, { activeTab, counts: COUNTS, params }))
}

describe('ListingTabs tab resolution', () => {
  it('resolves unknown, empty, and malformed tab values to Kõik', () => {
    expect(resolveListingTab(undefined)).toBe('koik')
    expect(resolveListingTab('')).toBe('koik')
    expect(resolveListingTab('nope')).toBe('koik')
    expect(resolveListingTab(['x'])).toBe('koik')
  })

  it('resolves ?tab=koik and every listed tab id back to itself', () => {
    expect(resolveListingTab('koik')).toBe('koik')
    for (const tab of LISTING_TABS) {
      expect(resolveListingTab(tab.id)).toBe(tab.id)
    }
  })

  it('exposes koik as the default tab and first entry with the all-types definition', () => {
    expect(DEFAULT_LISTING_TAB).toBe('koik')
    expect(LISTING_TAB_IDS[0]).toBe('koik')
    expect(koikDef.id).toBe('koik')
    expect(koikDef.label).toBe('Kõik objektid')
    expect(koikDef.heading).toBe('Aktiivsed oksjonid')
    expect(koikDef.allTypes).toBe(true)
    expect(koikDef.objectTypes).toEqual([])
  })

  it('keeps polumaad without allTypes and without objectTypes', () => {
    const polumaad = listingTabDef('polumaad')
    expect(polumaad.objectTypes).toEqual([])
    expect(polumaad.allTypes).toBeUndefined()
    // The page gate `allTypes || objectTypes.length > 0` stays false, so
    // Põllumaad skips the listing query and renders its empty state.
    expect(polumaad.allTypes === true || polumaad.objectTypes.length > 0).toBe(false)
  })
})

describe('ListingTabs shareable href', () => {
  it('round-trips ?tab=koik through buildListingHref and resolveListingTab', () => {
    const href = buildListingHref('koik', { tab: 'polumaad', county: 'Harju', page: '3' })
    const search = new URL(href, 'https://oksjonid.erametsad.ww0.dev').searchParams
    expect(search.get('tab')).toBe('koik')
    expect(resolveListingTab(search.get('tab') ?? undefined)).toBe('koik')
    expect(search.get('county')).toBe('Harju')
    expect(search.get('page')).toBeNull()
  })
})

describe('ListingTabs render', () => {
  it('renders every tab with its count and marks the active tab', () => {
    const html = render('koik')
    expect(html).toContain('Kõik objektid')
    expect(html).toContain('Põllumaad')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('>10<')
  })

  it('links each tab through its tab param', () => {
    const html = render('koik')
    expect(html).toContain('href="/?tab=koik"')
    expect(html).toContain('href="/?tab=polumaad"')
  })
})
