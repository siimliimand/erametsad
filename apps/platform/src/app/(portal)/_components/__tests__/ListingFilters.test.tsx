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
