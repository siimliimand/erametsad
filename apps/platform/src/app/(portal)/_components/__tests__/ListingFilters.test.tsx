import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
}))

import { ListingFilters } from '../ListingFilters'

function render(tab: string): string {
  return renderToString(createElement(ListingFilters, { tab }))
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
    const controls = html.match(/aria-controls="([^"]+)"/)
    expect(controls).not.toBeNull()
    const panelId = controls?.[1] ?? ''
    const panel = html.match(new RegExp(`<div id="${panelId}" class="([^"]+)"`))
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
