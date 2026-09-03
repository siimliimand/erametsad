import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// Mutable so individual tests can point the panel at a URL with filters.
const mocks = vi.hoisted(() => ({ searchParams: new URLSearchParams('') }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => '/',
  useSearchParams: () => mocks.searchParams,
}))

import {
  countActiveFilters,
  DEFAULT_LISTING_FILTERS,
  parseListingFilters,
  serializeListingFilters,
} from '../../_lib/filter-params'
import { ListingFilters } from '../ListingFilters'

function render(tab: string): string {
  return renderToString(createElement(ListingFilters, { tab }))
}

function renderWithQuery(tab: string, query: string): string {
  mocks.searchParams = new URLSearchParams(query)
  return render(tab)
}

describe('ListingFilters subscription entry', () => {
  it('offers the Telli teavitus action', () => {
    const html = render('mets')
    expect(html).toContain('Telli teavitus')
  })

  it('renders the filter panel content and closed subscription dialog', () => {
    const html = render('mets')
    expect(html).toContain('Filtrid')
    expect(html).toContain('Maakond')
    // The dialog mounts closed: no modal content leaks into the panel.
    expect(html).not.toContain('Salvestame teie aktiivsed filtrid')
  })

  it('collapses the panel by default and keeps no inline sort select', () => {
    const html = render('mets')
    // Sort options moved to ListingResultsBar; the panel only toggles via Filtrid.
    expect(html).not.toContain('Sorteeri')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-controls=')
  })
})

describe('ListingFilters mobile disclosure', () => {
  it('points the toggle at the collapsible panel id', () => {
    const html = render('mets')
    const controls = /aria-controls="([^"]+)"/.exec(html)
    expect(controls).not.toBeNull()
    const panelId = controls?.[1] ?? ''
    const panel = new RegExp(`<div id="${panelId}" class="([^"]+)"`).exec(html)
    expect(panel).not.toBeNull()
    // Hidden below lg until toggled open; always open from lg up.
    expect(panel?.[1]).toContain('hidden')
    expect(panel?.[1]).toContain('lg:flex')
  })

  it('keeps the toggle mobile-only and the static heading desktop-only', () => {
    const html = render('mets')
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*class="[^"]*lg:hidden/)
    expect(html).toMatch(/class="hidden [^"]*lg:flex"/)
  })

  // Clicking the toggle cannot be exercised here: this suite renders with
  // renderToString and has no DOM runner, so the opened state stays a
  // browser check for now.
})

describe('ListingFilters quick search (q)', () => {
  it('counts the q term in the active badge and shows Tühjenda', () => {
    const html = renderWithQuery('mets', 'q=metskits')
    expect(html).toContain('Tühjenda')
    expect(html).toMatch(/rounded-pill bg-primary[^>]*>1</)
  })

  it('keeps the badge empty and Tühjenda hidden without q', () => {
    const html = renderWithQuery('mets', '')
    expect(html).not.toContain('Tühjenda')
    expect(html).not.toMatch(/rounded-pill bg-primary[^>]*>\d+</)
  })

  it('parses, counts and serializes the q term', () => {
    const state = parseListingFilters(new URLSearchParams('q=metskits'))
    expect(state.q).toBe('metskits')
    expect(countActiveFilters(state)).toBe(1)
    expect(serializeListingFilters(state, 'mets')).toContain('q=metskits')
  })

  it('drops q when the state clears back to defaults', () => {
    expect(serializeListingFilters({ ...DEFAULT_LISTING_FILTERS }, 'mets')).not.toContain('q=')
    expect(countActiveFilters({ ...DEFAULT_LISTING_FILTERS })).toBe(0)
  })
})
